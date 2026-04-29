import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/tasks/my ────────────────────────────────────────────────────────
// Trả về task completions chưa hoàn thành mà role hiện tại có thể cập nhật
// JOIN với task_definitions để lấy label, stage_code
// JOIN với customers (qua customer_record_id) để lấy tên KH

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('id, role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Profile không tồn tại' }, { status: 403 })

    const service = createServiceClient()

    // Lấy task_definitions mà role này có thể cập nhật
    const { data: defs } = await service
      .from('task_definitions')
      .select('id, task_key, label, stage_code, bo_phan, roles_can_update, sort_order')
      .eq('is_active', true)
      .contains('roles_can_update', [me.role])

    if (!defs || defs.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const defIds = defs.map(d => d.id)
    const defMap = Object.fromEntries(defs.map(d => [d.id, d]))

    // Lấy completions chưa hoàn thành cho các task này
    const { data: completions } = await service
      .from('task_completions')
      .select('id, task_definition_id, customer_record_id, order_id, status, updated_at, updated_by_name, blocked_reason')
      .in('task_definition_id', defIds)
      .not('status', 'in', '("hoan_thanh")')
      .order('updated_at', { ascending: false })
      .limit(100)

    if (!completions || completions.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Batch fetch customer names
    const customerIds = [...new Set((completions as any[]).map(c => c.customer_record_id).filter(Boolean))] as number[]
    const { data: customers } = customerIds.length > 0
      ? await service.from('customers').select('id, ho_ten, pipeline').in('id', customerIds)
      : { data: [] }
    const custMap = Object.fromEntries((customers ?? []).map((c: any) => [c.id, c]))

    const tasks = (completions as any[]).map(c => {
      const def  = defMap[c.task_definition_id] ?? {}
      const cust = custMap[c.customer_record_id] ?? {}
      return {
        completion_id:       c.id,
        task_definition_id:  c.task_definition_id,
        task_key:            def.task_key ?? '',
        label:               def.label ?? '',
        stage_code:          def.stage_code ?? '',
        bo_phan:             def.bo_phan ?? '',
        status:              c.status ?? 'chua_lam',
        customer_record_id:  c.customer_record_id,
        customer_name:       cust.ho_ten ?? null,
        customer_pipeline:   cust.pipeline ?? null,
        order_id:            c.order_id,
        updated_at:          c.updated_at,
        updated_by_name:     c.updated_by_name,
        blocked_reason:      c.blocked_reason,
      }
    })

    return NextResponse.json({ data: tasks })
  } catch (err) {
    console.error('GET /api/tasks/my:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
