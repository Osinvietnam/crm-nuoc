import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type PriceTier = 'niem_yet' | 'chiet_khau' | 'dai_ly' | 'npp' | 'hide'

const tierColumn: Record<PriceTier, string | null> = {
  niem_yet:   'gia_niem_yet',
  chiet_khau: 'gia_chiet_khau',
  dai_ly:     'gia_dai_ly',
  npp:        'gia_npp',
  hide:       null,
}

// ─── POST /api/products/catalogue ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'ceo', 'director', 'sales'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      product_ids   = [] as number[],
      price_tier    = 'niem_yet' as PriceTier,
      nhom_sp,
      include_mo_ta = false,
    } = body

    if (!Object.keys(tierColumn).includes(price_tier)) {
      return NextResponse.json({ error: 'price_tier không hợp lệ' }, { status: 400 })
    }

    const selectFields = [
      'id', 'ten_sp', 'ma_sp', 'phan_loai', 'nhom_sp',
      'gia_niem_yet', 'gia_chiet_khau', 'gia_dai_ly', 'gia_npp',
      'image_url',
      include_mo_ta ? 'mo_ta' : null,
    ].filter(Boolean).join(', ')

    let query = supabase
      .from('products')
      .select(selectFields)
      .eq('con_hang', true)
      .order('nhom_sp', { ascending: true })
      .order('ten_sp',  { ascending: true })

    if (product_ids.length > 0) {
      query = query.in('id', product_ids)
    }
    if (nhom_sp) {
      query = query.eq('nhom_sp', nhom_sp)
    }

    const { data, error } = await query
    if (error) throw error

    const col = tierColumn[price_tier as PriceTier]

    const items = (data ?? []).map((p: any) => ({
      id:        p.id,
      ten_sp:    p.ten_sp,
      ma_sp:     p.ma_sp,
      phan_loai: p.phan_loai,
      nhom_sp:   p.nhom_sp,
      gia:       col ? (p[col] ?? null) : null,
      mo_ta:     include_mo_ta ? (p.mo_ta ?? null) : undefined,
      image_url: p.image_url ?? null,
    }))

    return NextResponse.json({
      items,
      generated_at: new Date().toISOString(),
      price_tier,
      total: items.length,
    })
  } catch (err) {
    console.error('POST /api/products/catalogue:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
