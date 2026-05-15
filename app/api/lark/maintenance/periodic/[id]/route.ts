import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mappers } from '../../_mappers'
import { logAudit } from '@/lib/audit'

const SELECT = `
  *,
  staff:nv_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt, dia_chi)
`

// ─── GET /api/lark/maintenance/periodic/[id] ──────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const query = supabase.from('maintenance_periodic').select(SELECT)
    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    return NextResponse.json({ data: mappers.periodic(data) })
  } catch (err) {
    console.error('GET /api/lark/maintenance/periodic/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/lark/maintenance/periodic/[id] ────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    const ALLOWED_ROLES = ['tech', 'admin', 'ceo', 'director']
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Không có quyền cập nhật bảo trì' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const updates: Record<string, unknown> = {}
    for (const key of ['trang_thai', 'ghi_chu', 'san_pham_da_lap', 'dich_vu', 'vat_tu', 'chu_ky', 'nv_phu_trach', 'ma_bddk']) {
      if (key in body) updates[key] = body[key]
    }
    // Date fields: UI sends ms timestamp → convert to ISO date
    for (const f of ['lan_bd_gan_nhat', 'lan_bd_tiep_theo']) {
      if (f in body) {
        updates[f] = body[f] ? new Date(Number(body[f])).toISOString().split('T')[0] : null
      }
    }

    const baseQuery = supabase.from('maintenance_periodic').update(updates).select(SELECT)
    const { data, error } = await (/^\d+$/.test(id)
      ? baseQuery.eq('id', parseInt(id))
      : baseQuery.eq('lark_record_id', id)
    ).single()
    if (error) throw error

    // H3: Bảo trì định kỳ active → advance pipeline KH → "Bảo trì" (forward-only)
    if (body.trang_thai === 'Đang hoạt động' && data.customer_id) {
      const PIPELINE_ORDER = ['Lead mới','Tiềm năng','Báo giá','Đàm phán','Chốt HĐ','Giao hàng','Nghiệm thu','Bảo hành','Bảo trì']
      const idx = PIPELINE_ORDER.indexOf('Bảo trì')
      const stagesBelow = PIPELINE_ORDER.slice(0, idx)
      void supabase.from('customers')
        .update({ pipeline: 'Bảo trì' })
        .eq('id', data.customer_id)
        .in('pipeline', stagesBelow)
    }
    void logAudit(supabase, { user_id: user.id, user_name: profile?.full_name ?? '', action: 'task_updated', entity: 'maintenance', detail: `Bảo dưỡng #${id}: ${Object.keys(updates).join(', ')}` })
    return NextResponse.json({ data: mappers.periodic(data) })
  } catch (err) {
    console.error('PATCH /api/lark/maintenance/periodic/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
