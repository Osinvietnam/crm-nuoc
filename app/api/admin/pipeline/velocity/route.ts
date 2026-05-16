import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PIPELINE_ORDER } from '@/lib/pipeline'

// ─── GET /api/admin/pipeline/velocity?period=90 ───────────────────────────────
// Trả về avg/median days KH spend tại mỗi stage trong pipeline_history
// period: số ngày nhìn lại (default 90, max 365)

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const period = Math.min(parseInt(req.nextUrl.searchParams.get('period') ?? '90') || 90, 365)
    const since  = new Date(Date.now() - period * 86_400_000).toISOString()
    const svc    = createServiceClient()

    // ── Lấy toàn bộ pipeline_history trong period, sort theo customer + time ──
    const { data: history } = await svc
      .from('pipeline_history')
      .select('customer_id, from_stage, to_stage, changed_at')
      .gte('changed_at', since)
      .order('customer_id')
      .order('changed_at', { ascending: true })

    // ── Tính thời gian spend tại từng stage ────────────────────────────────────
    // Mỗi entry trong pipeline_history = lúc KH ĐẾN stage to_stage
    // Thời gian spend tại stage to_stage = thời gian đến stage tiếp theo - thời gian đến stage này
    const stageDurations: Record<string, number[]> = {}

    // Group by customer
    const byCustomer: Record<number, { to_stage: string; changed_at: string }[]> = {}
    for (const row of history ?? []) {
      const cid = row.customer_id as number
      if (!byCustomer[cid]) byCustomer[cid] = []
      byCustomer[cid].push({ to_stage: row.to_stage as string, changed_at: row.changed_at as string })
    }

    // For each customer, calculate duration at each stage
    for (const entries of Object.values(byCustomer)) {
      for (let i = 0; i < entries.length - 1; i++) {
        const stage    = entries[i].to_stage
        const entryMs  = new Date(entries[i].changed_at).getTime()
        const exitMs   = new Date(entries[i + 1].changed_at).getTime()
        const daysInStage = (exitMs - entryMs) / 86_400_000

        if (daysInStage >= 0 && daysInStage < 365) {  // sanity check
          if (!stageDurations[stage]) stageDurations[stage] = []
          stageDurations[stage].push(daysInStage)
        }
      }
    }

    // ── Lấy stage order từ DB ─────────────────────────────────────────────────
    const { data: cfgs } = await svc
      .from('pipeline_configs')
      .select('stage_labels, order_type')
      .eq('is_active', true)

    let stageOrder = [...PIPELINE_ORDER] as string[]
    if (cfgs?.length) {
      const priority = ['Thuong_mai', 'Du_an', 'B2C']
      const sorted = [...cfgs].sort((a, b) =>
        (priority.indexOf(a.order_type) + 1 || 99) - (priority.indexOf(b.order_type) + 1 || 99)
      )
      const seen = new Set<string>()
      stageOrder = []
      for (const cfg of sorted) {
        for (const l of cfg.stage_labels as string[]) {
          if (!seen.has(l)) { seen.add(l); stageOrder.push(l) }
        }
      }
    }

    // ── Lấy SLA config ────────────────────────────────────────────────────────
    const { data: slaSettings } = await svc
      .from('company_settings')
      .select('key, value')
      .in('key', ['stage_sla_override', 'default_stage_sla_days'])

    const defaultSla = parseInt(slaSettings?.find(s => s.key === 'default_stage_sla_days')?.value ?? '7') || 7
    const slaOverride: Record<string, number> = slaSettings?.find(s => s.key === 'stage_sla_override')?.value
      ? JSON.parse(slaSettings.find(s => s.key === 'stage_sla_override')!.value)
      : {}

    // ── Build velocity array ──────────────────────────────────────────────────
    const velocity = stageOrder.filter(s => s !== 'Lost').map(stage => {
      const durations = stageDurations[stage] ?? []
      const sla       = slaOverride[stage] ?? defaultSla

      if (durations.length === 0) {
        return { stage, avg_days: null, median_days: null, p90_days: null, sample_count: 0, sla_days: sla, status: 'no_data' as const }
      }

      const sorted  = [...durations].sort((a, b) => a - b)
      const avg     = durations.reduce((s, v) => s + v, 0) / durations.length
      const median  = sorted[Math.floor(sorted.length / 2)]
      const p90     = sorted[Math.floor(sorted.length * 0.9)]

      const status: 'ok' | 'warning' | 'critical' =
        avg <= sla         ? 'ok' :
        avg <= sla * 1.5   ? 'warning' : 'critical'

      return {
        stage,
        avg_days:     Math.round(avg * 10) / 10,
        median_days:  Math.round(median * 10) / 10,
        p90_days:     Math.round(p90 * 10) / 10,
        sample_count: durations.length,
        sla_days:     sla,
        status,
      }
    })

    return NextResponse.json({ velocity, period, since })
  } catch (err) {
    console.error('GET /api/admin/pipeline/velocity:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
