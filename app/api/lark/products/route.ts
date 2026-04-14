import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapProduct } from './_mapper'

// ─── GET /api/lark/products ───────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('ten_sp', { ascending: true })
    if (error) throw error

    return NextResponse.json({ data: (data ?? []).map(mapProduct) })
  } catch (err) {
    console.error('GET /api/lark/products:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/lark/products ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'ceo'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    if (!body.ten_sp) {
      return NextResponse.json({ error: 'Tên sản phẩm là bắt buộc' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        ten_sp:         body.ten_sp,
        ma_sp:          body.ma_sp          || null,
        phan_loai:      body.phan_loai      || null,
        nhom_sp:        body.nhom_sp        || null,
        gia_niem_yet:   body.gia_niem_yet   ?? 0,
        gia_chiet_khau: body.gia_chiet_khau ?? 0,
        gia_dai_ly:     body.gia_dai_ly     ?? 0,
        gia_npp:        body.gia_npp        ?? 0,
        hh_kd:          body.hh_kd          ?? 0,
        mo_ta:          body.mo_ta          || null,
        con_hang:       body.con_hang       ?? true,
      })
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({ data: mapProduct(data) }, { status: 201 })
  } catch (err) {
    console.error('POST /api/lark/products:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
