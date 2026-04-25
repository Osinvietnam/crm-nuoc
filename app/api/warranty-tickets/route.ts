import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/warranty-tickets?order_id=&type= ───────────────────────────────
// type: 'bao_hanh' | 'bao_tri' | all (nếu không truyền)

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const order_id = req.nextUrl.searchParams.get('order_id')
    const type     = req.nextUrl.searchParams.get('type')

    if (!order_id) return NextResponse.json({ error: 'Thiếu order_id' }, { status: 400 })

    let query = supabase
      .from('warranty_tickets')
      .select(`
        *,
        assigned_tech_profile:assigned_tech(id, full_name),
        created_by_profile:created_by(id, full_name),
        warranty_tasks(*)
      `)
      .eq('order_id', Number(order_id))
      .order('created_at', { ascending: false })

    if (type) query = query.eq('ticket_type', type)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ tickets: data ?? [] })
  } catch (err) {
    console.error('GET /api/warranty-tickets:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/warranty-tickets — Tạo ticket mới + auto-seed tasks ───────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('id, role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    if (!['admin', 'ceo', 'director', 'sales'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền tạo ticket' }, { status: 403 })
    }

    const body = await req.json()
    const {
      order_id, ticket_type, title, severity,
      description, scheduled_date, assigned_tech,
    } = body

    if (!order_id || !ticket_type) {
      return NextResponse.json({ error: 'Bắt buộc: order_id, ticket_type' }, { status: 400 })
    }
    if (!['bao_hanh', 'bao_tri'].includes(ticket_type)) {
      return NextResponse.json({ error: 'ticket_type phải là bao_hanh hoặc bao_tri' }, { status: 400 })
    }

    const svc = createServiceClient()

    // ── Tính sequence_no tự động ──────────────────────────────────────────────
    const { count } = await svc
      .from('warranty_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', Number(order_id))
      .eq('ticket_type', ticket_type)

    const sequenceNo = (count ?? 0) + 1

    // ── Tạo ticket ────────────────────────────────────────────────────────────
    const { data: ticket, error: ticketErr } = await svc
      .from('warranty_tickets')
      .insert({
        order_id:       Number(order_id),
        ticket_type,
        sequence_no:    sequenceNo,
        title:          title ?? `${ticket_type === 'bao_hanh' ? 'Bảo hành' : 'Bảo trì'} lần ${sequenceNo}`,
        severity:       severity ?? null,
        status:         'open',
        description:    description ?? null,
        scheduled_date: scheduled_date ?? null,
        assigned_tech:  assigned_tech ?? null,
        created_by:     me.id,
      })
      .select()
      .single()

    if (ticketErr) throw ticketErr

    // ── Auto-seed tasks từ task_definitions theo stage BH hoặc BT ─────────────
    const stageCode = ticket_type === 'bao_hanh' ? 'BH' : 'BT'
    const { data: taskDefs } = await svc
      .from('task_definitions')
      .select('task_key')
      .eq('stage_code', stageCode)
      .eq('is_active', true)
      .order('sort_order')

    if (taskDefs && taskDefs.length > 0) {
      const seedTasks = taskDefs.map(d => ({
        ticket_id:   ticket.id,
        task_key:    d.task_key,
        status:      'dang_lam' as const,
        updated_by:  user.id,
        updated_by_name: me.full_name ?? user.email ?? '',
        updated_at:  new Date().toISOString(),
      }))

      const { error: tasksErr } = await svc
        .from('warranty_tasks')
        .insert(seedTasks)

      if (tasksErr) console.error('[warranty-tickets] Seed tasks error:', tasksErr)
    }

    // ── Load lại ticket với tasks ──────────────────────────────────────────────
    const { data: full } = await svc
      .from('warranty_tickets')
      .select('*, warranty_tasks(*)')
      .eq('id', ticket.id)
      .single()

    return NextResponse.json({ ticket: full }, { status: 201 })
  } catch (err) {
    console.error('POST /api/warranty-tickets:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/warranty-tickets?id= — Cập nhật ticket ──────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('id, role').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    // Kiểm tra quyền: admin/ceo/director hoặc tech được assign
    const { data: ticket } = await supabase
      .from('warranty_tickets')
      .select('assigned_tech, created_by')
      .eq('id', Number(id))
      .single()

    const isManager = ['admin', 'ceo', 'director'].includes(me.role)
    const isAssigned = ticket?.assigned_tech === user.id
    const isCreator  = ticket?.created_by === user.id

    if (!isManager && !isAssigned && !isCreator) {
      return NextResponse.json({ error: 'Không có quyền cập nhật ticket này' }, { status: 403 })
    }

    const body = await req.json()
    const allowed = [
      'title', 'status', 'severity', 'description',
      'scheduled_date', 'completed_date', 'assigned_tech',
    ]
    const patch: Record<string, any> = {}
    for (const k of allowed) {
      if (k in body) patch[k] = body[k]
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 })
    }

    const svc = createServiceClient()
    const { data, error } = await svc
      .from('warranty_tickets')
      .update(patch)
      .eq('id', Number(id))
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ ticket: data })
  } catch (err) {
    console.error('PATCH /api/warranty-tickets:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
