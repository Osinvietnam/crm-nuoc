import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/admin/pipeline/overview ────────────────────────────────────────
// Trả về:
// 1. Live count KH hiện tại theo pipeline stage (cho Flow Nodes — Option A)
// 2. Cross-pipeline comparison table (cho Option C)
// 3. SLA health per stage

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const svc = createServiceClient()

    // ── Parallel fetches ──────────────────────────────────────────────────────
    const [
      customersRes,
      configsRes,
      slaSettingsRes,
      historyRes,
      lostMonthRes,
    ] = await Promise.all([
      // Live KH count per pipeline stage
      svc.from('customers')
        .select('pipeline, is_active')
        .not('pipeline', 'is', null),

      // Pipeline configs for stage order
      svc.from('pipeline_configs')
        .select('order_type, stage_labels, stages, is_active')
        .order('order_type'),

      // SLA settings
      svc.from('company_settings')
        .select('key, value')
        .in('key', ['stage_sla_override', 'default_stage_sla_days']),

      // Pipeline history: last entry time per customer (for SLA health)
      svc.from('pipeline_history')
        .select('customer_id, to_stage, changed_at')
        .order('changed_at', { ascending: false })
        .limit(2000),

      // Lost this month count per source (for comparison grid summary)
      svc.from('customers')
        .select('pipeline')
        .eq('pipeline', 'Lost')
        .gte('updated_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ])

    // ── Parse SLA config ──────────────────────────────────────────────────────
    const defaultSla = parseInt(slaSettingsRes.data?.find(s => s.key === 'default_stage_sla_days')?.value ?? '7') || 7
    const slaOverride: Record<string, number> = (() => {
      const raw = slaSettingsRes.data?.find(s => s.key === 'stage_sla_override')?.value
      if (!raw) return {}
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return {} }
    })()

    // ── Build live count map ───────────────────────────────────────────────────
    const countMap: Record<string, number> = {}
    for (const row of customersRes.data ?? []) {
      if (!row.pipeline) continue
      countMap[row.pipeline] = (countMap[row.pipeline] ?? 0) + 1
    }

    // ── Build: last entry time per customer for current stage (for avg stuck) ─
    const lastEntryMap: Record<number, { stage: string; changed_at: string }> = {}
    for (const row of historyRes.data ?? []) {
      const cid = row.customer_id as number
      if (!lastEntryMap[cid]) {
        lastEntryMap[cid] = { stage: row.to_stage as string, changed_at: row.changed_at as string }
      }
    }

    // ── Compute avg stuck days per stage ──────────────────────────────────────
    const stageStuckDays: Record<string, number[]> = {}
    for (const kh of customersRes.data ?? []) {
      if (!kh.pipeline) continue
      // Find latest history entry where to_stage = current stage
      const entry = Object.entries(lastEntryMap).find(
        ([, v]) => v.stage === kh.pipeline
      )
      if (!entry) continue
      const days = Math.floor((Date.now() - new Date(entry[1].changed_at).getTime()) / 86_400_000)
      if (!stageStuckDays[kh.pipeline]) stageStuckDays[kh.pipeline] = []
      stageStuckDays[kh.pipeline].push(days)
    }

    const avgStuckDays: Record<string, number> = {}
    for (const [stage, days] of Object.entries(stageStuckDays)) {
      avgStuckDays[stage] = Math.round(days.reduce((a, b) => a + b, 0) / days.length)
    }

    // ── Build per-pipeline flow data (Option A — Flow Nodes) ──────────────────
    const pipelines = (configsRes.data ?? []).map(cfg => {
      const stages = (cfg.stage_labels as string[]).map((label, idx) => {
        const count   = countMap[label] ?? 0
        const sla     = slaOverride[label] ?? defaultSla
        const avgDays = avgStuckDays[label] ?? 0

        // SLA health: ok / warning / critical
        const slaStatus: 'ok' | 'warning' | 'critical' | 'empty' =
          count === 0       ? 'empty'    :
          avgDays <= sla    ? 'ok'       :
          avgDays <= sla*2  ? 'warning'  : 'critical'

        return {
          label,
          code:       (cfg.stages as string[])[idx] ?? label,
          count,
          sla_days:   sla,
          avg_days:   avgDays,
          sla_status: slaStatus,
        }
      })
      return {
        order_type:   cfg.order_type as string,
        is_active:    cfg.is_active as boolean,
        stages,
      }
    })

    // ── Build cross-pipeline comparison grid (Option C) ───────────────────────
    // Union of all unique stage labels (in order)
    const allStages: string[] = []
    const seen = new Set<string>()
    const priority = ['Thuong_mai', 'Du_an', 'B2C']
    const sortedCfgs = [...(configsRes.data ?? [])].sort((a, b) =>
      (priority.indexOf(a.order_type) + 1 || 99) - (priority.indexOf(b.order_type) + 1 || 99)
    )
    for (const cfg of sortedCfgs) {
      for (const label of cfg.stage_labels as string[]) {
        if (!seen.has(label)) { seen.add(label); allStages.push(label) }
      }
    }

    // Grid: stage → { order_type → count/sla_status }
    const grid = allStages.map(stage => {
      const row: Record<string, { count: number; sla_status: string; in_pipeline: boolean }> = {}
      for (const cfg of configsRes.data ?? []) {
        const inPipeline = (cfg.stage_labels as string[]).includes(stage)
        row[cfg.order_type as string] = {
          count:      inPipeline ? (countMap[stage] ?? 0) : 0,
          sla_status: inPipeline ? (
            (countMap[stage] ?? 0) === 0 ? 'empty' :
            (avgStuckDays[stage] ?? 0) <= (slaOverride[stage] ?? defaultSla) ? 'ok' :
            (avgStuckDays[stage] ?? 0) <= (slaOverride[stage] ?? defaultSla) * 2 ? 'warning' : 'critical'
          ) : 'na',
          in_pipeline: inPipeline,
        }
      }
      return { stage, row }
    })

    // Summary per pipeline type
    const summary = (configsRes.data ?? []).map(cfg => {
      const labels = cfg.stage_labels as string[]
      const total  = labels.reduce((s, l) => s + (countMap[l] ?? 0), 0)
      const lost   = lostMonthRes.data?.length ?? 0
      // Conversion Lead → Chốt (best effort from current counts)
      const lead   = countMap[labels[0]] ?? 0
      const chot   = countMap['Chốt HĐ'] ?? countMap['CH'] ?? 0
      return {
        order_type: cfg.order_type as string,
        total_active: total,
        lost_month:   lost,
        stages:       labels,
      }
    })

    return NextResponse.json({ pipelines, grid, stage_order: allStages, summary })
  } catch (err) {
    console.error('GET /api/admin/pipeline/overview:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
