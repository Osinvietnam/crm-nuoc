import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Vercel Cron — chạy mỗi ngày lúc 08:30 ICT (01:30 UTC)
// GET /api/cron/pipeline-sla
// Cảnh báo KH bị stuck trong stage quá SLA — notify sales + manager

// ─── Fallback SLA config ────────────────────────────────────────────────────
const DEFAULT_SLA: Record<string, number> = {
  'Lead mới':   30,
  'Tiềm năng':  14,
  'Báo giá':     7,
  'Đàm phán':    5,
  'Hồ sơ thầu': 14,
  'Chốt HĐ':    3,
  'Giao hàng':  14,
  'Nghiệm thu':  7,
}

async function getSlaMap(supabase: ReturnType<typeof createServiceClient>): Promise<Record<string, number>> {
  try {
    const { data } = await supabase
      .from('company_settings')
      .select('key, value')
      .in('key', ['stage_sla_override', 'default_stage_sla_days'])

    const defaultRow = data?.find(r => r.key === 'default_stage_sla_days')
    const overrideRow = data?.find(r => r.key === 'stage_sla_override')

    const defaultDays = defaultRow ? parseInt(String(defaultRow.value)) || 7 : 7
    const overrides: Record<string, number> = overrideRow?.value
      ? (typeof overrideRow.value === 'string' ? JSON.parse(overrideRow.value) : overrideRow.value)
      : {}

    // Merge: default SLA + company overrides (company wins)
    const merged: Record<string, number> = {}
    for (const [stage, days] of Object.entries(DEFAULT_SLA)) {
      merged[stage] = overrides[stage] ?? days
    }
    merged._default = defaultDays
    return merged
  } catch {
    return DEFAULT_SLA
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase    = createServiceClient()
    const todayStr    = new Date().toISOString().split('T')[0]
    let totalNotified = 0

    // ── 1. Load SLA config ────────────────────────────────────────────────────
    const slaMap = await getSlaMap(supabase)

    // ── 2. Lấy tất cả KH đang active (không phải Lost/Bảo hành/Bảo trì) ──────
    const activeStages = Object.keys(slaMap).filter(s => s !== '_default')

    const { data: customers } = await supabase
      .from('customers')
      .select('id, ho_ten, pipeline, nguoi_phu_trach, updated_at')
      .in('pipeline', activeStages)
      .not('nguoi_phu_trach', 'is', null)
      .eq('is_active', true)
      .limit(500)

    if (!customers?.length) {
      return NextResponse.json({ notified: 0, checked: 0, date: todayStr })
    }

    // ── 3. Lấy thời điểm KH vào stage hiện tại từ pipeline_history ──────────
    // Dùng subquery: lấy changed_at của lần cuối KH chuyển vào stage hiện tại
    const customerIds = customers.map(c => c.id)

    const { data: historyRows } = await supabase
      .from('pipeline_history')
      .select('customer_id, to_stage, changed_at')
      .in('customer_id', customerIds)
      .order('changed_at', { ascending: false })

    // Build map: customer_id → { to_stage, changed_at } của entry cuối cùng match current stage
    const stageEntryMap: Record<number, { to_stage: string; changed_at: string }> = {}
    for (const row of historyRows ?? []) {
      const kh = customers.find(c => c.id === row.customer_id)
      if (!kh) continue
      if (row.to_stage !== kh.pipeline) continue
      if (!stageEntryMap[row.customer_id]) {
        stageEntryMap[row.customer_id] = { to_stage: row.to_stage, changed_at: row.changed_at }
      }
    }

    // ── 4. Lấy danh sách manager để notify ───────────────────────────────────
    const { data: managers } = await supabase
      .from('profiles')
      .select('id, role')
      .in('role', ['admin', 'ceo', 'director'])
      .eq('is_active', true)

    // ── 5. Check từng KH — notify nếu stuck quá SLA ──────────────────────────
    for (const kh of customers) {
      const sla = slaMap[kh.pipeline] ?? slaMap._default ?? 7
      const entryDate = stageEntryMap[kh.id]?.changed_at ?? kh.updated_at

      const daysStuck = Math.floor(
        (Date.now() - new Date(entryDate).getTime()) / 86_400_000
      )

      if (daysStuck < sla) continue   // trong SLA → bỏ qua

      // Dedup: 1 SLA alert/KH/stage/ngày
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', kh.nguoi_phu_trach)
        .eq('type', 'pipeline_sla_exceeded')
        .like('link', `%/customers/${kh.id}%`)
        .gte('created_at', `${todayStr}T00:00:00Z`)
        .maybeSingle()

      if (existing) continue

      const overDays = daysStuck - sla
      const body = `${kh.ho_ten} đang ở "${kh.pipeline}" ${daysStuck} ngày (quá SLA ${sla} ngày${overDays > 0 ? `, chậm ${overDays} ngày` : ''})`

      // Notify sales phụ trách
      await supabase.from('notifications').insert({
        user_id: kh.nguoi_phu_trach,
        type:    'pipeline_sla_exceeded',
        title:   `⏰ Pipeline quá hạn: ${kh.ho_ten}`,
        body,
        link:    `/dashboard/customers/${kh.id}`,
      })
      totalNotified++

      // Notify managers (không duplicate sales nếu manager cũng là nguoi_phu_trach)
      for (const mgr of managers ?? []) {
        if (mgr.id === kh.nguoi_phu_trach) continue
        const { data: existingMgr } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', mgr.id)
          .eq('type', 'pipeline_sla_exceeded')
          .like('link', `%/customers/${kh.id}%`)
          .gte('created_at', `${todayStr}T00:00:00Z`)
          .maybeSingle()
        if (existingMgr) continue

        await supabase.from('notifications').insert({
          user_id: mgr.id,
          type:    'pipeline_sla_exceeded',
          title:   `⏰ Pipeline quá hạn: ${kh.ho_ten}`,
          body,
          link:    `/dashboard/customers/${kh.id}`,
        })
        totalNotified++
      }
    }

    console.log(`[cron/pipeline-sla] ${todayStr} — checked: ${customers.length}, notified: ${totalNotified}`)
    return NextResponse.json({ notified: totalNotified, checked: customers.length, date: todayStr })
  } catch (err) {
    console.error('cron/pipeline-sla:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
