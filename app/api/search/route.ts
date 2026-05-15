import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface SearchResult {
  type:  'customer' | 'quote' | 'order'
  id:    number
  title: string
  sub:   string
  href:  string
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (q.length < 2) return NextResponse.json({ results: [] })

    // ── Parallel search across 3 entities ─────────────────────────────────
    const [custRes, quoteRes, orderRes] = await Promise.all([
      supabase
        .from('customers')
        .select('id, ho_ten, sdt, pipeline')
        .or(`ho_ten.ilike.%${q}%,sdt.ilike.%${q}%,ma_kh.ilike.%${q}%`)
        .limit(5),
      supabase
        .from('quotes')
        .select('id, ma_bao_gia, trang_thai, type')
        .ilike('ma_bao_gia', `%${q}%`)
        .limit(5),
      supabase
        .from('orders')
        .select('id, type, trang_thai, ma_hd, ma_don, ma_da')
        .or(`ma_hd.ilike.%${q}%,ma_don.ilike.%${q}%,ma_da.ilike.%${q}%`)
        .limit(5),
    ])

    const orderHref = (id: number, type: string) => {
      if (type === 'commercial') return `/dashboard/contracts/commercial/${id}`
      if (type === 'project')    return `/dashboard/contracts/project/${id}`
      return `/dashboard/contracts/b2c/${id}`
    }

    const orderCode = (o: Record<string, unknown>) =>
      (o.ma_hd as string) || (o.ma_don as string) || (o.ma_da as string) || `HĐ #${o.id}`

    const typeLabel: Record<string, string> = {
      b2c:        'Hợp đồng',
      commercial: 'Đơn thương mại',
      project:    'Dự án',
    }

    const results: SearchResult[] = [
      ...(custRes.data ?? []).map(c => ({
        type:  'customer' as const,
        id:    c.id,
        title: c.ho_ten ?? `KH #${c.id}`,
        sub:   [c.sdt, c.pipeline].filter(Boolean).join(' · '),
        href:  `/dashboard/customers/${c.id}`,
      })),
      ...(quoteRes.data ?? []).map(q => ({
        type:  'quote' as const,
        id:    q.id,
        title: q.ma_bao_gia ?? `BG #${q.id}`,
        sub:   [q.type === 'project' ? 'Dự án' : 'B2C', q.trang_thai].filter(Boolean).join(' · '),
        href:  `/dashboard/quotes/${q.id}`,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(orderRes.data ?? []).map((o: any) => ({
        type:  'order' as const,
        id:    o.id,
        title: orderCode(o),
        sub:   [typeLabel[o.type as string] ?? 'Hợp đồng', o.trang_thai].filter(Boolean).join(' · '),
        href:  orderHref(o.id, o.type as string),
      })),
    ]

    return NextResponse.json({ results })
  } catch (err) {
    console.error('GET /api/search:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
