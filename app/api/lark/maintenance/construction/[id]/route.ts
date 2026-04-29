import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mappers } from '../../_mappers'
import { logAudit } from '@/lib/audit'

const SELECT = `
  *,
  ktv:ktv_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt, dia_chi)
`

// ─── Q5: CT "Nghiệm thu hoàn thành" → tự tạo maintenance_periodic ─────────────

async function autoCreatePeriodic(supabase: any, construction: any) {
  // Dedup: check by order_id if available
  if (construction.order_id) {
    const { data: existing } = await supabase
      .from('maintenance_periodic')
      .select('id')
      .eq('order_id', construction.order_id)
      .maybeSingle()
    if (existing) return
  }

  await supabase.from('maintenance_periodic').insert({
    customer_id:     construction.customer_id  ?? null,
    order_id:        construction.order_id     ?? null,
    san_pham_da_lap: construction.san_pham ? [construction.san_pham] : [],
    chu_ky:          6,
    trang_thai:      'Đang hoạt động',
    khu_vuc:         construction.khu_vuc ?? null,
  })
}

// ─── GET /api/lark/maintenance/construction/[id] ──────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const query = supabase.from('maintenance_construction').select(SELECT)
    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    return NextResponse.json({ data: mappers.construction(data) })
  } catch (err) {
    console.error('GET /api/lark/maintenance/construction/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/lark/maintenance/construction/[id] ────────────────────────────

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
    const ALLOWED_ROLES = ['tech', 'logistics', 'admin', 'ceo', 'director']
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Không có quyền cập nhật lắp đặt' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const updates: Record<string, unknown> = {}
    for (const key of ['trang_thai', 'ghi_chu', 'san_pham', 'ktv_phu_trach', 'ma_ct']) {
      if (key in body) updates[key] = body[key]
    }
    // Date fields: UI sends ms timestamp → convert to ISO date
    for (const f of ['ngay_gh_thuc', 'ngay_nt']) {
      if (f in body) {
        updates[f] = body[f] ? new Date(Number(body[f])).toISOString().split('T')[0] : null
      }
    }

    const baseQuery = supabase.from('maintenance_construction').update(updates).select(SELECT)
    const { data, error } = await (/^\d+$/.test(id)
      ? baseQuery.eq('id', parseInt(id))
      : baseQuery.eq('lark_record_id', id)
    ).single()
    if (error) throw error

    // Q5: CT Nghiệm thu hoàn thành → tự tạo maintenance_periodic
    //     + tự động đẩy pipeline KH → "Bảo hành" (C6)
    if (body.trang_thai === 'Nghiệm thu hoàn thành') {
      void autoCreatePeriodic(supabase, data).catch((e: unknown) => console.error('autoCreatePeriodic:', e))
      if (data.customer_id) {
        void (async () => {
          const { error: pipelineErr } = await supabase.from('customers')
            .update({ pipeline: 'Bảo hành' })
            .eq('id', data.customer_id)
          if (pipelineErr) console.error('Pipeline sync (construction):', pipelineErr)
        })()
      }
    }

    void logAudit(supabase, { user_id: user.id, user_name: profile?.full_name ?? '', action: 'task_updated', entity: 'maintenance', detail: `Lắp đặt #${id}: ${Object.keys(updates).join(', ')}` })
    return NextResponse.json({ data: mappers.construction(data) })
  } catch (err) {
    console.error('PATCH /api/lark/maintenance/construction/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
