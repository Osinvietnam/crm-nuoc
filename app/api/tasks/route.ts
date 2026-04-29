import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskWithStatus {
  // task definition fields
  task_key:            string
  label:               string
  bo_phan:             string
  task_type:           'mandatory' | 'optional' | 'conditional'
  requires_attachment: boolean
  order_types:         string[]
  roles_can_update:    string[]
  roles_can_approve:   string[]
  sort_order:          number
  // completion fields (null = chua_lam)
  completion_id:       number | null
  status:              'chua_lam' | 'dang_lam' | 'kiem_tra' | 'hoan_thanh' | 'blocked'
  blocked_reason:      string | null
  blocked_waiting_for: string | null
  attachment_url:      string | null
  notes:               string | null
  updated_by:          string | null
  updated_by_name:     string | null
  updated_at:          string | null
  // computed
  can_update:          boolean  // current user có quyền chuyển trạng thái
  can_approve:         boolean  // current user có quyền duyệt Hoàn thành
}

// ─── Helper: check quyền theo task_def ───────────────────────────────────────

function checkTaskPerms(role: string, taskDef: any) {
  const canUpdate  = taskDef.roles_can_update?.includes(role)  ?? false
  const canApprove = taskDef.roles_can_approve?.includes(role) ?? false
  return { canUpdate, canApprove }
}

// ─── GET /api/tasks?order_id=&stage= ─────────────────────────────────────────
// Trả về merged list: task_definitions + completions cho stage + order

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('id, role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Profile không tồn tại' }, { status: 403 })

    const params      = req.nextUrl.searchParams
    const order_id    = params.get('order_id')
    const stage       = params.get('stage')
    // legacy compat
    const customer_id = params.get('customer_record_id')

    if (!stage) {
      return NextResponse.json({ error: 'Thiếu stage' }, { status: 400 })
    }

    // ── Xác định order_type để filter task_definitions ────────────────────────
    let orderType = 'B2C'
    let resolvedOrderId: number | null = null

    if (order_id) {
      resolvedOrderId = Number(order_id)
      const { data: ord } = await supabase
        .from('orders').select('id, order_type').eq('id', resolvedOrderId).single()
      orderType = ord?.order_type ?? 'B2C'
    }

    // ── 1. Load task definitions cho stage này ────────────────────────────────
    const { data: defs, error: defsErr } = await supabase
      .from('task_definitions')
      .select('*')
      .eq('stage_code', stage)
      .eq('is_active', true)
      .contains('order_types', [orderType])
      .order('sort_order', { ascending: true })

    if (defsErr) throw defsErr

    // ── 2. Load completions ───────────────────────────────────────────────────
    let completionsQuery = supabase
      .from('task_completions')
      .select('*')
      .eq('stage', stage)

    if (resolvedOrderId) {
      completionsQuery = completionsQuery.eq('order_id', resolvedOrderId)
    } else if (customer_id) {
      completionsQuery = completionsQuery.eq('customer_record_id', customer_id)
    } else {
      return NextResponse.json({ error: 'Thiếu order_id hoặc customer_record_id' }, { status: 400 })
    }

    const { data: completions, error: compErr } = await completionsQuery
    if (compErr) throw compErr

    // ── 3. Merge: task def + completion ───────────────────────────────────────
    const compMap = new Map<string, any>()
    for (const c of (completions ?? [])) compMap.set(c.task_key, c)

    const { canUpdate: myCanUpdate, canApprove: myCanApprove } = { canUpdate: false, canApprove: false }

    const tasks: TaskWithStatus[] = (defs ?? []).map(def => {
      const comp = compMap.get(def.task_key) ?? null
      const { canUpdate, canApprove } = checkTaskPerms(me.role, def)

      return {
        task_key:            def.task_key,
        label:               def.label,
        bo_phan:             def.bo_phan,
        task_type:           def.task_type,
        requires_attachment: def.requires_attachment,
        order_types:         def.order_types,
        roles_can_update:    def.roles_can_update,
        roles_can_approve:   def.roles_can_approve,
        sort_order:          def.sort_order,
        // completion
        completion_id:       comp?.id        ?? null,
        status:              comp?.status     ?? 'chua_lam',
        blocked_reason:      comp?.blocked_reason      ?? null,
        blocked_waiting_for: comp?.blocked_waiting_for ?? null,
        attachment_url:      comp?.attachment_url      ?? null,
        notes:               comp?.notes               ?? null,
        updated_by:          comp?.updated_by          ?? null,
        updated_by_name:     comp?.updated_by_name     ?? null,
        updated_at:          comp?.updated_at          ?? null,
        // perms
        can_update:  canUpdate,
        can_approve: canApprove,
      }
    })

    return NextResponse.json({ tasks, role: me.role })
  } catch (err) {
    console.error('GET /api/tasks:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/tasks — Bắt đầu task (tạo record status='dang_lam') ───────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('id, role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const body = await req.json()
    const { order_id, customer_record_id, stage, task_key, notes } = body

    if (!stage || !task_key) {
      return NextResponse.json({ error: 'Thiếu stage hoặc task_key' }, { status: 400 })
    }
    if (!order_id && !customer_record_id) {
      return NextResponse.json({ error: 'Thiếu order_id hoặc customer_record_id' }, { status: 400 })
    }

    // ── Kiểm tra quyền từ task_definitions ───────────────────────────────────
    const { data: taskDef } = await supabase
      .from('task_definitions')
      .select('roles_can_update, roles_can_approve')
      .eq('task_key', task_key)
      .single()

    if (taskDef) {
      const { canUpdate } = checkTaskPerms(me.role, taskDef)
      if (!canUpdate) {
        return NextResponse.json({ error: 'Không có quyền bắt đầu task này' }, { status: 403 })
      }
    }

    // ── Upsert: tạo mới hoặc cập nhật nếu đã có ──────────────────────────────
    const svc = createServiceClient()
    const { data, error } = await svc
      .from('task_completions')
      .upsert({
        order_id:         order_id ? Number(order_id) : null,
        customer_record_id: customer_record_id ?? null,
        stage,
        task_key,
        status:           'dang_lam',
        notes:            notes ?? null,
        updated_by:       user.id,
        updated_by_name:  me.full_name ?? user.email ?? '',
        updated_at:       new Date().toISOString(),
        // backward compat
        completed_by:     user.id,
        completed_by_name: me.full_name ?? user.email ?? '',
        completed_at:     new Date().toISOString(),
      }, {
        onConflict: order_id
          ? 'order_id,stage,task_key'
          : 'customer_record_id,stage,task_key',
      })
      .select()
      .single()

    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? '',
      action:    'task_started',
      entity:    'task',
      detail:    `${task_key} — ${order_id ? `đơn #${order_id}` : `KH ${customer_record_id}`}`,
    })

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/tasks:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/tasks — Đổi trạng thái task ─────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  dang_lam:   ['kiem_tra', 'blocked'],
  kiem_tra:   ['hoan_thanh', 'dang_lam', 'blocked'],
  hoan_thanh: ['dang_lam'],         // chỉ admin/ceo/director được reopen
  blocked:    ['dang_lam', 'kiem_tra'],
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('id, role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const body = await req.json()
    const { id, status: newStatus, notes, blocked_reason, blocked_waiting_for, attachment_url } = body

    if (!id || !newStatus) {
      return NextResponse.json({ error: 'Thiếu id hoặc status' }, { status: 400 })
    }

    // ── Load completion hiện tại ──────────────────────────────────────────────
    const { data: comp, error: compErr } = await supabase
      .from('task_completions')
      .select('id, status, task_key, order_id, customer_record_id, stage')
      .eq('id', id)
      .single()

    if (compErr || !comp) {
      return NextResponse.json({ error: 'Không tìm thấy task' }, { status: 404 })
    }

    const currentStatus = comp.status as string

    // ── Validate state machine ────────────────────────────────────────────────
    const allowed = VALID_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({
        error: `Không thể chuyển từ "${currentStatus}" sang "${newStatus}"`,
      }, { status: 422 })
    }

    // ── Load task definition để check quyền ──────────────────────────────────
    const { data: taskDef } = await supabase
      .from('task_definitions')
      .select('roles_can_update, roles_can_approve, label')
      .eq('task_key', comp.task_key)
      .single()

    const isAdmin      = ['admin', 'ceo', 'director'].includes(me.role)
    const { canUpdate, canApprove } = taskDef
      ? checkTaskPerms(me.role, taskDef)
      : { canUpdate: isAdmin, canApprove: isAdmin }

    // Quyền theo từng loại transition
    if (newStatus === 'hoan_thanh' && !canApprove) {
      return NextResponse.json({ error: 'Không có quyền duyệt Hoàn thành' }, { status: 403 })
    }
    if (newStatus === 'dang_lam' && currentStatus === 'hoan_thanh' && !isAdmin) {
      return NextResponse.json({ error: 'Chỉ Admin/CEO/Phó GĐ mới được mở lại task đã hoàn thành' }, { status: 403 })
    }
    if (['kiem_tra', 'blocked'].includes(newStatus) && !canUpdate) {
      return NextResponse.json({ error: 'Không có quyền cập nhật task này' }, { status: 403 })
    }

    // blocked_reason bắt buộc khi blocked
    if (newStatus === 'blocked' && !blocked_reason?.trim()) {
      return NextResponse.json({ error: 'Cần ghi rõ lý do bị blocked' }, { status: 400 })
    }

    // ── Cập nhật ──────────────────────────────────────────────────────────────
    const svc = createServiceClient()
    const updatePayload: Record<string, any> = {
      status:              newStatus,
      updated_by:          user.id,
      updated_by_name:     me.full_name ?? user.email ?? '',
      updated_at:          new Date().toISOString(),
    }
    if (notes          !== undefined) updatePayload.notes               = notes
    if (attachment_url !== undefined) updatePayload.attachment_url      = attachment_url
    if (blocked_reason !== undefined) updatePayload.blocked_reason      = blocked_reason
    if (blocked_waiting_for !== undefined) updatePayload.blocked_waiting_for = blocked_waiting_for

    // Khi unblock → clear lý do
    if (newStatus !== 'blocked') {
      updatePayload.blocked_reason      = null
      updatePayload.blocked_waiting_for = null
    }

    const { data, error } = await svc
      .from('task_completions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? '',
      action:    'task_updated',
      entity:    'task',
      detail:    `${comp.task_key} → ${newStatus}`,
    })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('PATCH /api/tasks:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/tasks?id= — Reset về chua_lam (xóa record) ─────────────────

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    const isManager = ['admin', 'ceo', 'director'].includes(me.role)
    if (!isManager) {
      return NextResponse.json({ error: 'Chỉ Admin/CEO/Phó GĐ mới được reset task' }, { status: 403 })
    }

    const svc = createServiceClient()
    const { error } = await svc
      .from('task_completions')
      .delete()
      .eq('id', Number(id))

    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? '',
      action:    'task_reset',
      entity:    'task',
      detail:    `Reset task completion #${id}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/tasks:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
