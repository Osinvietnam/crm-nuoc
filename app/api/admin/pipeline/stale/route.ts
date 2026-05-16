import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/admin/pipeline/stale ───────────────────────────────────────────
// Trả về KH đang stuck tại stage hiện tại quá SLA
// Admin/CEO/Director only

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

    const stageFilter = req.nextUrl.searchParams.get('stage') ?? null
    const svc = createServiceClient()

    // ── Load SLA config ───────────────────────────────────────────────────────
    const { data: slaSettings } = await svc
      .from('company_settings')
      .select('key, value')
      .in('key', ['stage_sla_override', 'default_stage_sla_days'])

    const defaultSla = parseInt(slaSettings?.find(s => s.key === 'default_stage_sla_days')?.value ?? '7') || 7
    const slaOverride: Record<string, number> = slaSettings?.find(s => s.key === 'stage_sla_override')?.value
      ? JSON.parse(slaSettings.find(s => s.key === 'stage_sla_override')!.value)
      : {}

    // ── Query customers ───────────────────────────────────────────────────────
    let query = svc
      .from('customers')
      .select(`
        id, ho_ten, pipeline, updated_at,
        nguoi_phu_trach,
        profiles:nguoi_phu_trach ( full_name )
      `)
      .not('pipeline', 'in', '("Lost","Bảo hành","Bảo trì")')
      .eq('is_active', true)
      .order('updated_at', { ascending: true })
      .limit(200)

    if (stageFilter) query = query.eq('pipeline', stageFilter)

    const { data: customers, error } = await query
    if (error) throw error

    // ── Lấy pipeline_history để biết lần cuối KH vào stage hiện tại ──────────
    const customerIds = (customers ?? []).map(c => c.id)
    if (!customerIds.length) return NextResponse.json({ stale: [], total: 0 })

    const { data: history } = await svc
      .from('pipeline_history')
      .select('customer_id, to_stage, changed_at')
      .in('customer_id', customerIds)
      .order('changed_at', { ascending: false })

    // Build: last entry time for current stage per customer
    const entryMap: Record<number, string> = {}
    for (const row of history ?? []) {
      const kh = customers?.find(c => c.id === row.customer_id)
      if (!kh || entryMap[row.customer_id]) continue
      if (row.to_stage === kh.pipeline) entryMap[row.customer_id] = row.changed_at
    }

    // ── Tính days stuck + filter quá SLA ─────────────────────────────────────
    const stale = (customers ?? []).map(kh => {
      const entryDate  = entryMap[kh.id] ?? kh.updated_at
      const daysStuck  = Math.floor((Date.now() - new Date(entryDate).getTime()) / 86_400_000)
      const sla        = slaOverride[kh.pipeline] ?? defaultSla
      const overSla    = daysStuck - sla

      return {
        id:               kh.id,
        ho_ten:           kh.ho_ten,
        pipeline:         kh.pipeline,
        days_stuck:       daysStuck,
        sla_days:         sla,
        over_sla_days:    Math.max(0, overSla),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nguoi_phu_trach_name: (kh.profiles as any)?.full_name ?? null,
        entry_date:       entryDate,
        sla_status: overSla > sla ? 'critical' : overSla > 0 ? 'warning' : 'ok',
      }
    })
    .filter(kh => kh.days_stuck >= kh.sla_days)
    .sort((a, b) => b.over_sla_days - a.over_sla_days)

    return NextResponse.json({ stale, total: stale.length })
  } catch (err) {
    console.error('GET /api/admin/pipeline/stale:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
