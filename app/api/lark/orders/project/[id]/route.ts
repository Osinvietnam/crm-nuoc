import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapProject } from '../../_mappers'
import { logAudit } from '@/lib/audit'

const SELECT = `
  *,
  staff:nguoi_phu_trach(id, full_name)
`

// ─── GET /api/lark/orders/project/[id] ────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const query = supabase.from('orders').select(SELECT).eq('type', 'project')
    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    return NextResponse.json({ data: mapProject(data) })
  } catch (err) {
    console.error('GET /api/lark/orders/project/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/lark/orders/project/[id] ──────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const { id } = await params
    const body = await req.json()

    const updates: Record<string, unknown> = {}
    for (const key of ['trang_thai', 'ghi_chu', 'giai_doan', 'ten_da', 'chu_dau_tu', 'tong_thau', 'loai_da', 'quy_mo', 'tinh_thanh', 'gia_tri_dt', 'gia_tri_hd', 'ty_le_thang', 'cong_no']) {
      if (key in body) updates[key] = body[key]
    }
    // doi_tac from UI maps to doi_tac_da in DB
    if ('doi_tac' in body) updates.doi_tac_da = body.doi_tac
    // Date fields: UI sends ms timestamp → convert to ISO date
    for (const f of ['ngay_bao_gia', 'ngay_du_kien_ky', 'ngay_bt_tc', 'ngay_hoan_thanh']) {
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

    void logAudit(supabase, { user_id: user.id, user_name: profile?.full_name ?? '', action: 'order_updated', entity: 'order', detail: `Dự án #${id}: ${Object.keys(updates).join(', ')}` })
    return NextResponse.json({ data: mapProject(data) })
  } catch (err) {
    console.error('PATCH /api/lark/orders/project/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
