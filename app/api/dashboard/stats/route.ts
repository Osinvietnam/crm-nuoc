import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PIPELINE_STAGES } from '@/lib/lark/tables'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthRevenue { label: string; value: number }

export interface DashboardStats {
  total_customers:           number
  new_customers_month:       number
  pending_quotes:            number
  orders_month:              number
  maintenance_today:         number
  pipeline:                  Record<string, number>
  revenue_month:             number
  revenue_6months:           MonthRevenue[]
  contracts_unpaid:          number
  maintenance_week:          number
  construction_ongoing:      number
  maintenance_overdue:       number
  logistics_pending:         number
  logistics_delivering:      number
  logistics_delivered_month: number
  logistics_overdue:         number
  kh_no_contact_30d:         number
  quotes_stale:              number
  quotes_cho_duyet:          number   // báo giá đang chờ manager duyệt
  // Phase 8 — Finance
  hoa_hong_chua_tra:         number   // tổng VNĐ hoa hồng chưa trả
  khau_hao_thang:            number   // tổng khấu hao tháng hiện tại
  cong_no_qua_han:           number   // tổng công nợ quá hạn (due_date < today)
  warranty_tickets_pending:  number   // yêu cầu bảo hành Chờ xử lý
  // Phase 15B — OKR
  kpi_target: { target_revenue: number; target_contracts: number; target_customers: number } | null
  // Phase 15C — Leaderboard, Regional, Insights
  leaderboard:       { user_id: string; full_name: string; revenue: number; deals: number }[]
  khu_vuc_breakdown: Record<string, number>
  insights:          { icon: string; text: string; type: 'positive' | 'warning' | 'info' }[]
  // Phase 15A — Activity Feed & P&L
  activity_feed: { user_name: string; action: string; entity: string; detail: string; created_at: string }[]
  pl_summary: {
    doanh_thu: number; chi_phi: number; hoa_hong: number
    khau_hao:  number; loi_nhuan: number; bien_loi_nhuan_pct: number
  } | null
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function monthBounds(offsetMonths = 0) {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0)
  return {
    from: start.toISOString().split('T')[0],
    to:   end.toISOString().split('T')[0],
  }
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function weekBounds() {
  const now  = new Date()
  const day  = now.getDay() || 7
  const mon  = new Date(now); mon.setDate(now.getDate() - day + 1)
  const sun  = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { from: mon.toISOString().split('T')[0], to: sun.toISOString().split('T')[0] }
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0]
}

function last6MonthsLabels(): MonthRevenue[] {
  const result: MonthRevenue[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ label: `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`, value: 0 })
  }
  return result
}

function monthLabelFromDate(d: string): string {
  const dt = new Date(d)
  return `T${dt.getMonth() + 1}/${String(dt.getFullYear()).slice(2)}`
}

function zero(): DashboardStats {
  return {
    total_customers: 0, new_customers_month: 0, pending_quotes: 0,
    orders_month: 0, maintenance_today: 0, pipeline: {},
    revenue_month: 0, revenue_6months: last6MonthsLabels(), contracts_unpaid: 0,
    maintenance_week: 0, construction_ongoing: 0, maintenance_overdue: 0,
    logistics_pending: 0, logistics_delivering: 0, logistics_delivered_month: 0,
    logistics_overdue: 0, kh_no_contact_30d: 0, quotes_stale: 0, quotes_cho_duyet: 0,
    hoa_hong_chua_tra: 0, khau_hao_thang: 0, cong_no_qua_han: 0, warranty_tickets_pending: 0,
    kpi_target: null, leaderboard: [], khu_vuc_breakdown: {}, insights: [],
    activity_feed: [], pl_summary: null,
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role, khu_vuc')
      .eq('id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const { role } = profile
    const isManager  = ['admin', 'ceo', 'director', 'accountant'].includes(role)
    const isSales    = role === 'sales' || role === 'partner'
    const isTech     = role === 'tech'
    const isLogistics = role === 'logistics'

    const { from: mFrom, to: mTo } = monthBounds()
    const today   = todayStr()
    const { from: wFrom, to: wTo } = weekBounds()
    const ago30   = daysAgo(30)
    const sixMoAgo = monthBounds(-5).from

    const stats = zero()

    // ── A. Khách hàng ─────────────────────────────────────────────────────────
    // RLS already filters: sales sees own, tech sees khu_vuc, admin/ceo see all

    const nowD = new Date()
    const [custAllRes, custMonthRes, noContactRes, pipelineRes, kpiRes] = await Promise.all([
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('customers').select('*', { count: 'exact', head: true })
        .gte('ngay_lien_he_dau', mFrom).lte('ngay_lien_he_dau', mTo),
      supabase.from('customers').select('*', { count: 'exact', head: true })
        .or(`ngay_follow_up.is.null,ngay_follow_up.lt.${ago30}`)
        .not('pipeline', 'in', '("Từ chối","Bảo hành")'),
      supabase.from('customers').select('pipeline'),
      supabase.from('kpi_targets')
        .select('target_revenue, target_contracts, target_customers')
        .eq('user_id', user.id)
        .eq('month', nowD.getMonth() + 1)
        .eq('year', nowD.getFullYear())
        .maybeSingle(),
    ])

    stats.total_customers     = custAllRes.count   ?? 0
    stats.new_customers_month = custMonthRes.count ?? 0
    stats.kh_no_contact_30d   = noContactRes.count ?? 0
    stats.kpi_target          = kpiRes.data        ?? null

    for (const stage of PIPELINE_STAGES) stats.pipeline[stage] = 0
    for (const r of pipelineRes.data ?? []) {
      const s = r.pipeline as string
      if (s in stats.pipeline) stats.pipeline[s]++
    }

    // ── B. Báo giá ────────────────────────────────────────────────────────────
    if (!isLogistics && !isTech) {
      let pendingQ = supabase.from('quotes').select('*', { count: 'exact', head: true })
        .in('trang_thai', ['Nháp', 'Đã gửi'])
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
      let staleQ   = supabase.from('quotes').select('*', { count: 'exact', head: true })
        .eq('trang_thai', 'Đã gửi')
        .or(`ngay_gui_kh.is.null,ngay_gui_kh.lt.${sevenDaysAgo}`)

      if (isSales) {
        pendingQ = pendingQ.eq('nguoi_phu_trach', profile.id)
        staleQ   = staleQ.eq('nguoi_phu_trach', profile.id)
      }

      const choDuyetQ = isManager
        ? supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('trang_thai', 'Chờ duyệt')
        : null

      const [pq, sq, cdq] = await Promise.all([pendingQ, staleQ, choDuyetQ ?? Promise.resolve({ count: 0 })])
      stats.pending_quotes    = (pq as any).count ?? 0
      stats.quotes_stale      = (sq as any).count ?? 0
      stats.quotes_cho_duyet  = (cdq as any).count ?? 0
    }

    // ── C. Đơn hàng tháng ────────────────────────────────────────────────────
    if (!isTech) {
      let ordersQ = supabase.from('orders').select('*', { count: 'exact', head: true })
        .gte('created_at', mFrom + 'T00:00:00Z')
        .lte('created_at', mTo   + 'T23:59:59Z')
      if (isSales) ordersQ = ordersQ.eq('nguoi_phu_trach', profile.id)

      const { count } = await ordersQ
      stats.orders_month = count ?? 0
    }

    // ── D. Bảo trì ───────────────────────────────────────────────────────────
    if (!isLogistics) {
      // Build base queries then conditionally filter
      const techId = isTech ? profile.id : null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const addTech = (q: any, col: string) => techId ? q.eq(col, techId) : q

      const [ptTodayR, ptWeekR, ptOverdueR, ctTodayR, ctWeekR, ctOngoingR] = await Promise.all([
        addTech(supabase.from('maintenance_periodic').select('*', { count: 'exact', head: true }).eq('lan_bd_tiep_theo', today), 'nv_phu_trach'),
        addTech(supabase.from('maintenance_periodic').select('*', { count: 'exact', head: true }).gte('lan_bd_tiep_theo', wFrom).lte('lan_bd_tiep_theo', wTo), 'nv_phu_trach'),
        addTech(supabase.from('maintenance_periodic').select('*', { count: 'exact', head: true }).lt('lan_bd_tiep_theo', today).eq('trang_thai', 'Đang hoạt động'), 'nv_phu_trach'),
        addTech(supabase.from('maintenance_construction').select('*', { count: 'exact', head: true }).eq('ngay_can_cs', today), 'ktv_phu_trach'),
        addTech(supabase.from('maintenance_construction').select('*', { count: 'exact', head: true }).gte('ngay_can_cs', wFrom).lte('ngay_can_cs', wTo), 'ktv_phu_trach'),
        addTech(supabase.from('maintenance_construction').select('*', { count: 'exact', head: true }).eq('trang_thai', 'Đang thi công'), 'ktv_phu_trach'),
      ])

      stats.maintenance_today    = (ptTodayR.count ?? 0) + (ctTodayR.count ?? 0)
      stats.maintenance_week     = (ptWeekR.count  ?? 0) + (ctWeekR.count  ?? 0)
      stats.maintenance_overdue  = ptOverdueR.count  ?? 0
      stats.construction_ongoing = ctOngoingR.count  ?? 0
    }

    // ── E. Revenue (manager group) ────────────────────────────────────────────
    if (isManager) {
      // Lấy payment_records đã thanh toán trong 6 tháng qua
      const { data: payments6M } = await supabase
        .from('payment_records')
        .select('amount, paid_date')
        .eq('is_paid', true)
        .gte('paid_date', sixMoAgo)

      // Unpaid installments
      const { count: unpaid } = await supabase
        .from('payment_records')
        .select('*', { count: 'exact', head: true })
        .eq('is_paid', false)

      stats.contracts_unpaid = unpaid ?? 0

      const months   = last6MonthsLabels()
      const monthMap = Object.fromEntries(months.map(m => [m.label, 0]))

      for (const p of payments6M ?? []) {
        const label = monthLabelFromDate(p.paid_date)
        if (label in monthMap) monthMap[label] += p.amount ?? 0
      }

      const currentLabel       = `T${new Date().getMonth() + 1}/${String(new Date().getFullYear()).slice(2)}`
      stats.revenue_month      = monthMap[currentLabel] ?? 0
      stats.revenue_6months    = months.map(m => ({ label: m.label, value: monthMap[m.label] ?? 0 }))

      // Phase 8: hoa hồng chưa trả, khấu hao tháng, công nợ quá hạn
      const service = createServiceClient()
      const [commRes, assetsRes, overdueRes] = await Promise.all([
        service.from('orders').select('hh_kinh_doanh').eq('type', 'b2c').eq('hh_da_tra', false).gt('hh_kinh_doanh', 0),
        service.from('assets').select('gia_tri_ban_dau, ngay_mua, thoi_gian_kh_thang').eq('is_active', true),
        service.from('payment_records').select('amount').eq('is_paid', false).lt('due_date', today),
      ])

      stats.hoa_hong_chua_tra = (commRes.data ?? []).reduce((s, o) => s + (o.hh_kinh_doanh ?? 0), 0)
      stats.cong_no_qua_han   = (overdueRes.data ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)

      const now = new Date()
      let khtong = 0
      for (const a of assetsRes.data ?? []) {
        const purchase = new Date(a.ngay_mua)
        const elapsed  = (now.getFullYear() - purchase.getFullYear()) * 12 + (now.getMonth() - purchase.getMonth())
        if (elapsed < a.thoi_gian_kh_thang) {
          khtong += Math.round(a.gia_tri_ban_dau / a.thoi_gian_kh_thang)
        }
      }
      stats.khau_hao_thang = khtong

      // Activity feed — 10 hoạt động gần nhất
      const { data: feedRows } = await service
        .from('audit_logs')
        .select('user_name, action, entity, detail, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      stats.activity_feed = feedRows ?? []

      // P&L summary tháng này
      const nowDate  = new Date()
      const curMonth = nowDate.getMonth() + 1
      const curYear  = nowDate.getFullYear()
      const [expRes, commPaidRes] = await Promise.all([
        service.from('expenses').select('amount')
          .eq('thang', curMonth).eq('nam', curYear),
        service.from('orders').select('hh_kinh_doanh')
          .eq('hh_da_tra', true)
          .gte('hh_ngay_tra', mFrom).lte('hh_ngay_tra', mTo),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pl_cp = (expRes.data      ?? []).reduce((s, e: any) => s + (e.amount        ?? 0), 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pl_hh = (commPaidRes.data ?? []).reduce((s, o: any) => s + (o.hh_kinh_doanh ?? 0), 0)
      const pl_dt = stats.revenue_month
      const pl_kh = stats.khau_hao_thang
      const pl_ln = pl_dt - pl_cp - pl_hh - pl_kh
      stats.pl_summary = {
        doanh_thu: pl_dt, chi_phi: pl_cp, hoa_hong: pl_hh, khau_hao: pl_kh,
        loi_nhuan: pl_ln,
        bien_loi_nhuan_pct: pl_dt > 0 ? Math.round(pl_ln / pl_dt * 100) : 0,
      }

      // ── Phase 15C: Leaderboard + Regional Heatmap + AI Insights ─────────────
      const [lbRecordsRes, regionalRes] = await Promise.all([
        service.from('payment_records')
          .select('nguoi_phu_trach_id, amount')
          .eq('is_paid', true)
          .gte('paid_date', mFrom)
          .lte('paid_date', mTo)
          .not('nguoi_phu_trach_id', 'is', null),
        service.from('customers')
          .select('khu_vuc')
          .not('pipeline', 'in', '("Lost","Từ chối")'),
      ])

      // Leaderboard: group → sort → top 5 → enrich with names
      const lbMap: Record<string, { revenue: number; deals: number }> = {}
      for (const r of lbRecordsRes.data ?? []) {
        const uid = r.nguoi_phu_trach_id as string
        if (!lbMap[uid]) lbMap[uid] = { revenue: 0, deals: 0 }
        lbMap[uid].revenue += (r.amount ?? 0)
        lbMap[uid].deals++
      }
      const topIds = Object.entries(lbMap)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .map(([id]) => id)
      if (topIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lbProfiles } = await service.from('profiles').select('id, full_name').in('id', topIds)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nameMap = Object.fromEntries((lbProfiles ?? []).map((p: any) => [p.id, p.full_name as string]))
        stats.leaderboard = topIds.map(id => ({
          user_id:   id,
          full_name: (nameMap[id] as string) ?? 'Không rõ',
          revenue:   lbMap[id].revenue,
          deals:     lbMap[id].deals,
        }))
      }

      // Regional heatmap
      const kvMap: Record<string, number> = {}
      for (const c of regionalRes.data ?? []) {
        const kv = (c.khu_vuc as string | null) || 'Khác'
        kvMap[kv] = (kvMap[kv] ?? 0) + 1
      }
      stats.khu_vuc_breakdown = kvMap

      // AI Insights (rule-based, prioritise warning > positive > info, max 3)
      const fmtVnd = (n: number) =>
        n >= 1_000_000_000 ? (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ'
        : n >= 1_000_000   ? Math.round(n / 1_000_000) + ' tr'
        : n.toLocaleString('vi-VN')

      const ins: { icon: string; text: string; type: 'positive' | 'warning' | 'info' }[] = []

      // R1: Revenue trend (current vs prev month)
      const rev6 = stats.revenue_6months
      if (rev6.length >= 2) {
        const curr = rev6[rev6.length - 1].value
        const prev = rev6[rev6.length - 2].value
        if (prev > 0 && curr >= prev * 1.1) {
          ins.push({ icon: '📈', text: `Doanh số tháng này cao hơn ${Math.round((curr - prev) / prev * 100)}% so với tháng trước`, type: 'positive' })
        } else if (prev > 0 && curr <= prev * 0.9) {
          ins.push({ icon: '📉', text: `Doanh số giảm ${Math.round((prev - curr) / prev * 100)}% so với tháng trước — cần kiểm tra pipeline`, type: 'warning' })
        }
      }

      // R2: KH no-contact risk
      if (stats.kh_no_contact_30d > 5)
        ins.push({ icon: '⚠️', text: `${stats.kh_no_contact_30d} KH chưa liên hệ > 30 ngày — nguy cơ mất KH`, type: 'warning' })

      // R3: Overdue receivables
      if (stats.cong_no_qua_han > 0)
        ins.push({ icon: '💰', text: `${fmtVnd(stats.cong_no_qua_han)}đ công nợ quá hạn cần thu hồi ngay`, type: 'warning' })

      // R4: Pipeline conversion (Báo giá+Đàm phán → Chốt HĐ)
      const pipelineBQ = (stats.pipeline['Báo giá'] ?? 0) + (stats.pipeline['Đàm phán'] ?? 0)
      const pipelineChot = stats.pipeline['Chốt HĐ'] ?? 0
      if (pipelineBQ + pipelineChot >= 5) {
        const convPct = Math.round(pipelineChot / (pipelineBQ + pipelineChot) * 100)
        if (convPct >= 50)
          ins.push({ icon: '🎯', text: `Tỷ lệ chốt HĐ tốt (${convPct}% từ Báo giá + Đàm phán)`, type: 'positive' })
        else if (convPct < 25)
          ins.push({ icon: '💡', text: `Tỷ lệ chốt HĐ thấp (${convPct}%) — cần cải thiện quy trình bán hàng`, type: 'warning' })
      }

      // R5: Maintenance overdue
      if (stats.maintenance_overdue > 3)
        ins.push({ icon: '🔧', text: `${stats.maintenance_overdue} bảo trì định kỳ quá hạn chưa xử lý`, type: 'warning' })

      // R6: Hoa hồng pending
      if (stats.hoa_hong_chua_tra > 0)
        ins.push({ icon: '💸', text: `Còn ${fmtVnd(stats.hoa_hong_chua_tra)}đ hoa hồng chưa trả cho nhân viên kinh doanh`, type: 'info' })

      // R7: Leader shoutout
      if (stats.leaderboard.length > 0) {
        const top = stats.leaderboard[0]
        if (top.revenue > 0)
          ins.push({ icon: '🏆', text: `${top.full_name} dẫn đầu doanh số tháng: ${fmtVnd(top.revenue)}đ (${top.deals} đơn)`, type: 'positive' })
      }

      const sevOrder: Record<string, number> = { warning: 0, positive: 1, info: 2 }
      ins.sort((a, b) => sevOrder[a.type] - sevOrder[b.type])
      stats.insights = ins.slice(0, 3)
    }

    // ── G. Bảo hành ──────────────────────────────────────────────────────────
    if (isTech || isManager) {
      let wq = supabase.from('warranty_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('trang_thai', 'Chờ xử lý')
      if (isTech) wq = wq.eq('nguoi_xu_ly', profile.id)
      const { count: wCount } = await wq
      stats.warranty_tickets_pending = wCount ?? 0
    }

    // ── F. Logistics ──────────────────────────────────────────────────────────
    if (isLogistics || isManager) {
      const [lPending, lDelivering, lDelivered, lOverdue] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('type', 'commercial')
          .in('trang_thai', ['Chờ xác nhận', 'Đang chuẩn bị']),
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('type', 'commercial').eq('trang_thai', 'Đang giao'),
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('type', 'commercial')
          .in('trang_thai', ['Đã giao', 'Đã thanh toán'])
          .gte('updated_at', mFrom + 'T00:00:00Z')
          .lte('updated_at', mTo   + 'T23:59:59Z'),
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('type', 'commercial')
          .in('trang_thai', ['Chờ xác nhận', 'Đang chuẩn bị', 'Đang giao'])
          .lt('ngay_giao_dk', today),
      ])

      stats.logistics_pending         = lPending.count   ?? 0
      stats.logistics_delivering      = lDelivering.count ?? 0
      stats.logistics_delivered_month = lDelivered.count  ?? 0
      stats.logistics_overdue         = lOverdue.count    ?? 0
    }

    return NextResponse.json({ data: stats, role })
  } catch (err) {
    console.error('GET /api/dashboard/stats:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
