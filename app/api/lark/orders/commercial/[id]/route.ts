import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapCommercial } from '../../_mappers'
import { logAudit } from '@/lib/audit'

const SELECT = `
  *,
  staff:nguoi_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt)
`

// ─── GET /api/lark/orders/commercial/[id] ─────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const query = supabase.from('orders').select(SELECT).eq('type', 'commercial')
    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    return NextResponse.json({ data: mapCommercial(data) })
  } catch (err) {
    console.error('GET /api/lark/orders/commercial/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/lark/orders/commercial/[id] ───────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const canUpdate     = ['admin', 'ceo', 'director', 'sales', 'logistics'].includes(profile.role)
    const canEditFinance = ['admin', 'ceo', 'director', 'accountant'].includes(profile.role)
    if (!canUpdate) return NextResponse.json({ error: 'Không có quyền cập nhật đơn hàng' }, { status: 403 })

    const { id } = await params
    const body = await req.json()

    const updates: Record<string, unknown> = {}
    for (const key of ['trang_thai', 'ghi_chu', 'loai_khach', 'tinh_thanh', 'san_pham_text', 'ma_sp_text', 'so_luong', 'phuong_thuc_tt']) {
      if (key in body) updates[key] = body[key]
    }
    // Financial fields — restricted to finance roles
    if (canEditFinance) {
      for (const key of ['don_gia', 'tong_tien']) {
        if (key in body) updates[key] = body[key]
      }
    }
    // ten_kh from UI maps to ten_kh_tm in DB
    if ('ten_kh' in body) updates.ten_kh_tm = body.ten_kh
    // Date fields: UI sends ms timestamp → convert to ISO date
    for (const f of ['ngay_dat', 'ngay_giao_dk', 'ngay_giao_thuc']) {
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

    void logAudit(supabase, { user_id: user.id, user_name: profile?.full_name ?? '', action: 'order_updated', entity: 'order', detail: `Đơn TM #${id}: ${Object.keys(updates).join(', ')}` })
    return NextResponse.json({ data: mapCommercial(data) })
  } catch (err) {
    console.error('PATCH /api/lark/orders/commercial/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
