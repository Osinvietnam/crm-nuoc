import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapContract } from '../../_mappers'

const SELECT = `
  *,
  staff:nguoi_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt)
`

// ─── Q4: HĐ "Đang thi công" → tự tạo maintenance_construction ────────────────

async function autoCreateConstruction(supabase: any, order: any) {
  // Dedup: one construction record per order
  const { data: existing } = await supabase
    .from('maintenance_construction')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle()
  if (existing) return

  await supabase.from('maintenance_construction').insert({
    order_id:    order.id,
    customer_id: order.customer_id  ?? null,
    khu_vuc:     order.khu_vuc      ?? null,
    san_pham:    order.san_pham?.[0] ?? null,
    trang_thai:  'Đang thi công',
  })
}

// ─── GET /api/lark/orders/contract/[id] ───────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const query = supabase.from('orders').select(SELECT).eq('type', 'b2c')
    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    return NextResponse.json({ data: mapContract(data) })
  } catch (err) {
    console.error('GET /api/lark/orders/contract/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/lark/orders/contract/[id] ─────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const updates: Record<string, unknown> = {}
    for (const key of ['trang_thai', 'ghi_chu', 'gia_tri_hd', 'gia_tri_gws', 'hh_kinh_doanh', 'san_pham', 'dia_chi_ct']) {
      if (key in body) updates[key] = body[key]
    }
    // Date fields: UI sends ms timestamp → convert to ISO date
    for (const f of ['ngay_ky', 'ngay_giao_dk', 'ngay_giao_thuc']) {
      if (f in body) {
        updates[f] = body[f] ? new Date(Number(body[f])).toISOString().split('T')[0] : null
      }
    }

    const baseQuery = supabase.from('orders').update(updates).select(SELECT)
    const { data, error } = await (/^\d+$/.test(id)
      ? baseQuery.eq('id', parseInt(id))
      : baseQuery.eq('lark_record_id', id)
    ).single()
    if (error) throw error

    // Q4: HĐ Đang thi công → tự tạo maintenance_construction
    if (body.trang_thai === 'Đang thi công') {
      void autoCreateConstruction(supabase, data).catch((e: unknown) => console.error('autoCreateConstruction:', e))
    }

    // Q3: HĐ Hoàn thành → pipeline KH → "Bảo hành"
    if (body.trang_thai === 'Hoàn thành' && data.customer_id) {
      void supabase.from('customers').update({ pipeline: 'Bảo hành' }).eq('id', data.customer_id)
    }

    return NextResponse.json({ data: mapContract(data) })
  } catch (err) {
    console.error('PATCH /api/lark/orders/contract/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
