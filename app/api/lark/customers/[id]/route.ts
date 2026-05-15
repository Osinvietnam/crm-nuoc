import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STAGE_TASKS } from '@/lib/tasks/checklist'
import { logAudit } from '@/lib/audit'
import { logActivity } from '@/lib/activity'

function toMs(d: string | null | undefined): number | null {
  if (!d) return null
  const ms = new Date(d).getTime()
  return isNaN(ms) ? null : ms
}

function mapRow(c: any) {
  return {
    record_id:          c.id.toString(),
    id:                 c.id,
    ho_ten:             c.ho_ten            ?? '',
    sdt:                c.sdt               ?? '',
    sdt_khac:           c.sdt_khac          ?? '',
    email:              c.email             ?? '',
    ma_kh:              c.ma_kh             ?? '',
    dia_chi_hd:         c.dia_chi_hd        ?? '',
    dia_chi_ct:         c.dia_chi_ct        ?? '',
    pipeline:           c.pipeline          ?? 'Lead mới',
    nguoi_phu_trach:    c.profiles?.full_name ?? '',
    nguoi_phu_trach_id: c.nguoi_phu_trach   ?? null,
    nguon_kh:           c.nguon_kh          ?? '',
    doi_tac_gt:         c.doi_tac_gt        ?? '',
    loai_hinh_nha:      c.loai_hinh_nha     ?? '',
    nguon_nuoc:         c.nguon_nuoc        ?? '',
    san_pham_quan_tam:  c.san_pham_quan_tam ?? [],
    bao_gia:            c.bao_gia           ?? 0,
    muc_uu_tien:        c.muc_uu_tien       ?? 'Trung bình',
    ngay_lien_he_dau:   toMs(c.ngay_lien_he_dau),
    ngay_cap_nhat:      toMs(c.updated_at),
    noi_dung:           c.noi_dung          ?? '',
    ly_do_tu_choi:      c.ly_do_tu_choi     ?? '',
    nhom_dv:            c.nhom_dv           ?? '',
    tien_do_ct:         c.tien_do_ct        ?? '',
    khu_vuc:            c.khu_vuc           ?? '',
    loai_kh:            c.loai_kh           ?? '',
    doi_tac_id:         c.doi_tac_id        ?? null,
  }
}

// ─── GET /api/lark/customers/[id] ────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Support numeric Supabase id AND legacy lark_record_id
    const query = supabase
      .from('customers')
      .select('*, profiles!nguoi_phu_trach(id, full_name)')

    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

    return NextResponse.json({ customer: mapRow(data) })
  } catch (err) {
    console.error('GET /api/lark/customers/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/lark/customers/[id] ──────────────────────────────────────────

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

    const allowed = [
      'ho_ten', 'sdt', 'sdt_khac', 'email', 'dia_chi_hd', 'dia_chi_ct',
      'pipeline', 'nguoi_phu_trach', 'nguon_kh', 'doi_tac_gt', 'loai_hinh_nha',
      'nguon_nuoc', 'san_pham_quan_tam', 'bao_gia', 'muc_uu_tien', 'noi_dung',
      'ly_do_tu_choi', 'nhom_dv', 'tien_do_ct', 'khu_vuc',
    ]

    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Không có trường nào để cập nhật' }, { status: 400 })
    }

    // Load current customer + caller profile in parallel (for warning checks)
    const numericId = /^\d+$/.test(id) ? parseInt(id) : null
    const [{ data: current }, { data: profile }] = await Promise.all([
      numericId
        ? supabase.from('customers').select('id, pipeline, nguoi_phu_trach').eq('id', numericId).single()
        : supabase.from('customers').select('id, pipeline, nguoi_phu_trach').eq('lark_record_id', id).single(),
      supabase.from('profiles').select('role, full_name').eq('id', user.id).single(),
    ])

    // KH-A3: Chỉ admin/ceo/director mới được reassign nguoi_phu_trach
    if ('nguoi_phu_trach' in updates && !['admin', 'ceo', 'director'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Không có quyền chuyển người phụ trách' }, { status: 403 })
    }

    const updateQuery = supabase
      .from('customers')
      .update(updates)
      .select('*, profiles!nguoi_phu_trach(id, full_name)')

    const { data, error } = await (numericId !== null
      ? updateQuery.eq('id', numericId)
      : updateQuery.eq('lark_record_id', id)
    ).single()

    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: profile?.full_name ?? '',
      action:    'customer_updated',
      entity:    'customer',
      detail:    `KH #${numericId ?? id}: ${Object.keys(updates).join(', ')}`,
      after:     updates as Record<string, unknown>,
    })

    // Activity: pipeline change
    if ('pipeline' in updates && updates.pipeline !== current?.pipeline) {
      void logActivity(supabase, {
        customer_id: (data as any).id ?? current?.id,
        user_id:     user.id,
        user_name:   profile?.full_name ?? '',
        type:        'pipeline_change',
        content:     `Chuyển pipeline: ${current?.pipeline ?? '?'} → ${updates.pipeline as string}`,
        meta: {
          from: current?.pipeline,
          to:   updates.pipeline as string,
          ...(updates.ly_do_tu_choi ? { reason: updates.ly_do_tu_choi } : {}),
        },
      })
    }

    // LOG-A11: Log riêng khi nguoi_phu_trach thay đổi
    if ('nguoi_phu_trach' in updates && updates.nguoi_phu_trach !== current?.nguoi_phu_trach) {
      void logAudit(supabase, {
        user_id:   user.id,
        user_name: profile?.full_name ?? '',
        action:    'customer_reassigned',
        entity:    'customer',
        detail:    `KH #${numericId ?? id}: chuyển từ ${current?.nguoi_phu_trach ?? 'chưa có'} → ${updates.nguoi_phu_trach}`,
        before:    { nguoi_phu_trach: current?.nguoi_phu_trach ?? null },
        after:     { nguoi_phu_trach: updates.nguoi_phu_trach as string },
      })
    }

    // PRD-02: Warn if san_pham_quan_tam contains unknown product names
    if (Array.isArray(updates.san_pham_quan_tam) && (updates.san_pham_quan_tam as string[]).length > 0) {
      const names = updates.san_pham_quan_tam as string[]
      const { data: known } = await supabase.from('products').select('ten_sp').in('ten_sp', names)
      const knownNames = new Set((known ?? []).map((p: { ten_sp: string }) => p.ten_sp))
      const unknown = names.filter(n => !knownNames.has(n))
      if (unknown.length > 0) {
        console.warn(`PRD-02: san_pham_quan_tam chứa sản phẩm không có trong danh mục: ${unknown.join(', ')} (KH #${numericId ?? id})`)
      }
    }

    // ── Warning checks (H5 + H6) — non-blocking ──────────────────────────────
    const warnings: string[] = []
    const newPipeline = updates.pipeline as string | undefined
    const isManager = ['admin', 'ceo', 'director'].includes(profile?.role ?? '')

    if (newPipeline && current && newPipeline !== current.pipeline && !isManager) {
      const customerId: number = (data as any).id ?? current?.id

      // H5: Payment prerequisite warnings
      const paymentStages: Record<string, { installment: number; label: string }> = {
        'Giao hàng':  { installment: 1, label: 'Đợt 1 (60%)' },
        'Nghiệm thu': { installment: 2, label: 'Đợt 2 (35%)' },
        'Bảo hành':   { installment: 3, label: 'Đợt 3 (5%)' },
      }
      const payReq = paymentStages[newPipeline]
      if (payReq) {
        const { data: payRow } = await supabase
          .from('payment_records')
          .select('is_paid')
          .eq('customer_id', customerId)
          .eq('installment', payReq.installment)
          .maybeSingle()
        if (!payRow?.is_paid) {
          warnings.push(`Chưa xác nhận thanh toán ${payReq.label} — đề nghị kế toán cập nhật trước khi chuyển sang "${newPipeline}"`)
        }
      }

      // H6: Task checklist completion warnings
      const stageTasks = STAGE_TASKS[current.pipeline] ?? []
      if (stageTasks.length > 0) {
        const { data: completed } = await supabase
          .from('task_completions')
          .select('task_key')
          .eq('customer_id', customerId)
          .eq('stage', current.pipeline)
        const completedKeys = new Set((completed ?? []).map((t: any) => t.task_key))
        const missing = stageTasks.filter(t => !completedKeys.has(t.key))
        if (missing.length > 0) {
          warnings.push(`Còn ${missing.length} việc chưa hoàn thành ở bước "${current.pipeline}": ${missing.map(t => t.label).join(', ')}`)
        }
      }
    }

    return NextResponse.json({
      customer: mapRow(data),
      ...(warnings.length ? { warnings } : {}),
    })
  } catch (err) {
    console.error('PATCH /api/lark/customers/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
