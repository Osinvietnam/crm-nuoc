import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PIPELINE_ORDER } from '@/lib/pipeline'

// ─── GET /api/admin/pipeline/funnel?period=30 ─────────────────────────────────
// Trả về funnel stats: count per stage + conversion rate sang stage tiếp theo
// period: số ngày nhìn lại (default 30, max 365)

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

    const period  = Math.min(parseInt(req.nextUrl.searchParams.get('period') ?? '30') || 30, 365)
    const since   = new Date(Date.now() - period * 86_400_000).toISOString()
    const svc     = createServiceClient()

    // ── 1. Count KH hiện tại theo stage ──────────────────────────────────────
    const { data: currentCounts } = await svc
      .from('customers')
      .select('pipeline')
      .not('pipeline', 'is', null)

    const countMap: Record<string, number> = {}
    for (const row of currentCounts ?? []) {
      const s = row.pipeline as string
      countMap[s] = (countMap[s] ?? 0) + 1
    }

    // ── 2. Lấy pipeline_history trong period để tính conversion ──────────────
    const { data: history } = await svc
      .from('pipeline_history')
      .select('customer_id, from_stage, to_stage, changed_at')
      .gte('changed_at', since)
      .order('changed_at', { ascending: true })

    // ── 3. Lấy stage order từ DB (fallback PIPELINE_ORDER) ───────────────────
    const { data: cfgs } = await svc
      .from('pipeline_configs')
      .select('stage_labels, order_type')
      .eq('is_active', true)

    let stageOrder = [...PIPELINE_ORDER] as string[]
    if (cfgs?.length) {
      // Build union: Thuong_mai first (most complete)
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
      if (!seen.has('Lost')) stageOrder.push('Lost')
    }

    // ── 4. Tính conversion: ai đã đi từ stage X → stage X+1 trong period ─────
    // Track: customers that passed through each stage
    const passedThrough: Record<string, Set<number>> = {}
    for (const row of history ?? []) {
      const s = row.to_stage as string
      if (!passedThrough[s]) passedThrough[s] = new Set()
      passedThrough[s].add(row.customer_id as number)
    }

    // ── 5. Build funnel array ─────────────────────────────────────────────────
    const funnel = stageOrder.map((stage, idx) => {
      const count         = countMap[stage] ?? 0
      const enteredCount  = passedThrough[stage]?.size ?? 0
      const nextStage     = stageOrder[idx + 1]
      const nextEntered   = nextStage ? (passedThrough[nextStage]?.size ?? 0) : 0
      const conversionPct = enteredCount > 0 && nextStage
        ? Math.round((nextEntered / enteredCount) * 100)
        : null

      return {
        stage,
        count,                  // KH đang ở stage này hiện tại
        entered_period: enteredCount,  // KH đã vào stage này trong period
        conversion_pct: conversionPct, // % → stage tiếp theo (null nếu là stage cuối)
        next_stage: nextStage ?? null,
      }
    })

    return NextResponse.json({ funnel, period, since })
  } catch (err) {
    console.error('GET /api/admin/pipeline/funnel:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
