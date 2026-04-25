import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/tasks/check-advance?order_id=&stage= ───────────────────────────
// Kiểm tra xem có thể chuyển sang stage tiếp theo không.
// Trả về: can_advance, danh sách task bắt buộc chưa xong, cảnh báo.

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params             = req.nextUrl.searchParams
    const order_id           = params.get('order_id')
    const customer_record_id = params.get('customer_record_id')
    const stage              = params.get('stage')

    if (!stage) {
      return NextResponse.json({ error: 'Thiếu stage' }, { status: 400 })
    }

    // ── Xác định order_type ───────────────────────────────────────────────────
    let orderType = 'B2C'
    if (order_id) {
      const { data: ord } = await supabase
        .from('orders').select('order_type').eq('id', Number(order_id)).single()
      orderType = ord?.order_type ?? 'B2C'
    }

    // ── Load task_definitions bắt buộc cho stage + order_type ────────────────
    const { data: defs } = await supabase
      .from('task_definitions')
      .select('task_key, label, bo_phan, task_type')
      .eq('stage_code', stage)
      .eq('is_active', true)
      .contains('order_types', [orderType])

    const mandatoryDefs  = (defs ?? []).filter(d => d.task_type === 'mandatory')
    const optionalDefs   = (defs ?? []).filter(d => d.task_type === 'optional')
    const mandatoryKeys  = mandatoryDefs.map(d => d.task_key)

    if (mandatoryKeys.length === 0) {
      return NextResponse.json({
        can_advance:          true,
        mandatory_incomplete: [],
        optional_incomplete:  [],
        warning_message:      null,
      })
    }

    // ── Load completions đã Hoàn thành ────────────────────────────────────────
    let completionsQuery = supabase
      .from('task_completions')
      .select('task_key, status')
      .eq('stage', stage)
      .eq('status', 'hoan_thanh')
      .in('task_key', mandatoryKeys)

    if (order_id) {
      completionsQuery = completionsQuery.eq('order_id', Number(order_id))
    } else if (customer_record_id) {
      completionsQuery = completionsQuery.eq('customer_record_id', customer_record_id)
    } else {
      return NextResponse.json({ error: 'Thiếu order_id hoặc customer_record_id' }, { status: 400 })
    }

    const { data: doneComps } = await completionsQuery
    const doneKeys = new Set((doneComps ?? []).map(c => c.task_key))

    // ── Tính incomplete ───────────────────────────────────────────────────────
    const mandatoryIncomplete = mandatoryDefs.filter(d => !doneKeys.has(d.task_key))

    // Optional: load tất cả completions để tính optional_incomplete
    let allCompQuery = supabase
      .from('task_completions')
      .select('task_key, status')
      .eq('stage', stage)
      .neq('status', 'hoan_thanh')

    if (order_id) {
      allCompQuery = allCompQuery.eq('order_id', Number(order_id))
    } else if (customer_record_id) {
      allCompQuery = allCompQuery.eq('customer_record_id', customer_record_id)
    }

    const { data: allComps } = await allCompQuery
    const notDoneKeys = new Set((allComps ?? []).map(c => c.task_key))

    const optionalIncomplete = optionalDefs.filter(d =>
      !doneKeys.has(d.task_key) || notDoneKeys.has(d.task_key)
    )

    // ── Tạo warning message ────────────────────────────────────────────────────
    const canAdvance = mandatoryIncomplete.length === 0
    let warningMessage: string | null = null

    if (!canAdvance) {
      const names = mandatoryIncomplete.slice(0, 3).map(d => d.label).join(', ')
      const more  = mandatoryIncomplete.length > 3 ? ` và ${mandatoryIncomplete.length - 3} việc khác` : ''
      warningMessage = `${mandatoryIncomplete.length} việc bắt buộc chưa hoàn thành: ${names}${more}`
    } else if (optionalIncomplete.length > 0) {
      warningMessage = `Còn ${optionalIncomplete.length} việc khuyến khích chưa làm. Vẫn có thể chuyển stage.`
    }

    return NextResponse.json({
      can_advance:          canAdvance,
      mandatory_incomplete: mandatoryIncomplete,
      optional_incomplete:  optionalIncomplete,
      warning_message:      warningMessage,
    })
  } catch (err) {
    console.error('GET /api/tasks/check-advance:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
