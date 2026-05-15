import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/lark/products/[id]/price-history ────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { data, error } = await supabase
      .from('product_price_history')
      .select('id, loai_gia, gia_cu, gia_moi, changed_by, changed_at, profiles(full_name)')
      .eq('product_id', id)
      .order('changed_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const rows = (data ?? []).map((r: any) => {
      const gia_cu: number = r.gia_cu ?? 0
      const gia_moi: number = r.gia_moi ?? 0
      let pct_change: number | null = null
      if (gia_cu !== 0) {
        pct_change = Math.round(((gia_moi - gia_cu) / gia_cu) * 100 * 10) / 10
      }
      return {
        id: r.id,
        loai_gia: r.loai_gia,
        gia_cu,
        gia_moi,
        pct_change,
        changed_by_name: r.profiles?.full_name ?? null,
        changed_at: r.changed_at,
      }
    })

    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET /api/lark/products/[id]/price-history:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
