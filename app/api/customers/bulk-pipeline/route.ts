import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'

// ─── PATCH /api/customers/bulk-pipeline ──────────────────────────────────────
// Bulk move nhiều KH sang 1 stage cùng lúc
// Body: { customer_ids: number[], pipeline: string, note?: string }
// Admin only — max 50 KH/lần

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Chỉ admin/ceo/director mới bulk update được' }, { status: 403 })
    }

    // Rate limit: 5 bulk operations per minute
    if (!rateLimit(`${user.id}:bulk_pipeline`, 5)) {
      return NextResponse.json({ error: 'Quá nhiều thao tác bulk. Thử lại sau 1 phút.' }, { status: 429 })
    }

    const body = await req.json()
    const { customer_ids, pipeline: newStage, note } = body as {
      customer_ids: number[]
      pipeline: string
      note?: string
    }

    if (!customer_ids?.length || !newStage) {
      return NextResponse.json({ error: 'Thiếu customer_ids hoặc pipeline' }, { status: 400 })
    }
    if (customer_ids.length > 50) {
      return NextResponse.json({ error: 'Tối đa 50 KH mỗi lần bulk update' }, { status: 400 })
    }

    // Validate stage là một giá trị hợp lệ
    const svc = createServiceClient()
    const { data: cfgs } = await svc
      .from('pipeline_configs')
      .select('stage_labels')
      .eq('is_active', true)

    const allLabels = new Set<string>(['Lost'])
    for (const cfg of cfgs ?? []) {
      for (const l of cfg.stage_labels as string[]) allLabels.add(l)
    }
    if (!allLabels.has(newStage)) {
      return NextResponse.json({ error: `Stage "${newStage}" không hợp lệ` }, { status: 400 })
    }

    // ── Update customers ──────────────────────────────────────────────────────
    const { data: updated, error } = await svc
      .from('customers')
      .update({ pipeline: newStage })
      .in('id', customer_ids)
      .select('id, ho_ten, pipeline')

    if (error) throw error

    // ── Ghi note vào pipeline_history entries nếu có ─────────────────────────
    if (note?.trim()) {
      // Lấy entries vừa được tạo bởi trigger
      const { data: latestEntries } = await svc
        .from('pipeline_history')
        .select('id, customer_id')
        .in('customer_id', customer_ids)
        .eq('to_stage', newStage)
        .order('changed_at', { ascending: false })
        .limit(customer_ids.length)

      // Deduplicate: lấy entry mới nhất per customer
      const seenCustomers = new Set<number>()
      const entryIds: number[] = []
      for (const entry of latestEntries ?? []) {
        if (!seenCustomers.has(entry.customer_id)) {
          seenCustomers.add(entry.customer_id)
          entryIds.push(entry.id)
        }
      }
      if (entryIds.length) {
        await svc.from('pipeline_history')
          .update({ notes: note.trim() })
          .in('id', entryIds)
      }
    }

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? '',
      action:    'customer_updated',
      entity:    'customer',
      detail:    `Bulk pipeline → "${newStage}": ${customer_ids.length} KH${note ? ` | Ghi chú: ${note}` : ''}`,
      after:     { pipeline: newStage, customer_ids },
    })

    return NextResponse.json({
      success: true,
      updated: updated?.length ?? 0,
      stage:   newStage,
    })
  } catch (err) {
    console.error('PATCH /api/customers/bulk-pipeline:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
