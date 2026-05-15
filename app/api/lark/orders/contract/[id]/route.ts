import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapContract } from '../../_mappers'
import { logAudit } from '@/lib/audit'

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

  // ngay_du_kien = ngay_giao_dk from the order (expected delivery date)
  const ngay_du_kien = order.ngay_giao_dk ?? null

  await supabase.from('maintenance_construction').insert({
    order_id:        order.id,
    customer_id:     order.customer_id    ?? null,
    khu_vuc:         order.khu_vuc        ?? null,
    san_pham:        order.san_pham?.[0]  ?? null,
    trang_thai:      'Đang thi công',
    nguoi_phu_trach: order.nguoi_phu_trach ?? null,
    ngay_du_kien,
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

    const { data: profile } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const isManager = ['admin', 'ceo', 'director'].includes(profile.role)
    const canEditFinance = ['admin', 'ceo', 'director', 'accountant'].includes(profile.role)

    const { id } = await params
    const body = await req.json()

    // Chặn non-manager sửa trường tài chính/hoa hồng
    if (!canEditFinance) {
      for (const f of ['hh_da_tra', 'hh_ngay_tra', 'hh_phan_tram', 'gia_tri_hd', 'hh_kinh_doanh']) {
        delete body[f]
      }
    }

    const updates: Record<string, unknown> = {}
    for (const key of ['trang_thai', 'ghi_chu', 'gia_tri_hd', 'gia_tri_gws', 'san_pham', 'dia_chi_ct', 'hh_phan_tram', 'hh_da_tra', 'hh_ngay_tra']) {
      if (key in body) updates[key] = body[key]
    }
    // hh_phan_tram đổi → tự tính lại hh_kinh_doanh (FIN-07: không cho set trực tiếp nếu không phải manager)
    if ('hh_phan_tram' in body || 'gia_tri_hd' in body) {
      const pct = Number(body.hh_phan_tram ?? 0)
      const val = Number(body.gia_tri_hd   ?? 0)
      if (pct > 0 && val > 0) {
        updates.hh_kinh_doanh = Math.round(val * pct / 100)
      }
    } else if ('hh_kinh_doanh' in body && isManager) {
      updates.hh_kinh_doanh = body.hh_kinh_doanh
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

    // CJ-12: HĐ Hoàn thành → tự tạo bảo hành 24 tháng (dedup: 1 warranty per order)
    if (body.trang_thai === 'Hoàn thành' && data.id) {
      void (async () => {
        const { data: existing } = await supabase
          .from('order_warranties').select('id').eq('order_id', data.id).maybeSingle()
        if (!existing) {
          // bat_dau = actual delivery date if available, else today
          const startDate = data.ngay_giao_thuc ? new Date(data.ngay_giao_thuc) : new Date()
          const endDate   = new Date(startDate)
          endDate.setMonth(endDate.getMonth() + 24)
          const bat_dau = startDate.toISOString().split('T')[0]
          const het_han = endDate.toISOString().split('T')[0]
          const { error: wErr } = await supabase.from('order_warranties').insert({
            order_id:   data.id,
            bat_dau,
            het_han,
            loai_bh:    '24 tháng',
            created_by: user.id,
          })
          if (wErr) console.error('Auto warranty:', wErr.message)
        }
      })()
    }

    // C6: Tự động cập nhật pipeline KH theo trạng thái hợp đồng
    // Giao hàng (thi công) → Nghiệm thu → Bảo hành
    // Mapping contract.trang_thai → customer.pipeline (đúng với CONTRACT_STATUS_COLORS)
    const PIPELINE_BY_CONTRACT_STATUS: Record<string, string> = {
      'Đang thi công':  'Giao hàng',
      'Chờ nghiệm thu': 'Nghiệm thu',
      'Hoàn thành':     'Bảo hành',
    }
    if (body.trang_thai && data.customer_id) {
      const newPipeline = PIPELINE_BY_CONTRACT_STATUS[body.trang_thai]
      if (newPipeline) {
        const PIPELINE_ORDER = ['Lead mới','Tiềm năng','Báo giá','Đàm phán','Chốt HĐ','Giao hàng','Nghiệm thu','Bảo hành','Bảo trì']
        const idx = PIPELINE_ORDER.indexOf(newPipeline)
        const stagesBelow = idx > 0 ? PIPELINE_ORDER.slice(0, idx) : []
        if (stagesBelow.length > 0) {
          void supabase.from('customers')
            .update({ pipeline: newPipeline })
            .eq('id', data.customer_id)
            .in('pipeline', stagesBelow)
        }
      }
    }

    void logAudit(supabase, { user_id: user.id, user_name: profile.full_name ?? '', action: 'order_updated', entity: 'order', detail: `HĐ #${id}: ${Object.keys(updates).join(', ')}` })
    return NextResponse.json({ data: mapContract(data) })
  } catch (err) {
    console.error('PATCH /api/lark/orders/contract/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
