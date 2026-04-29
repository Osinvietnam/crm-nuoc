import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PIPELINE_STAGES } from '@/lib/lark/tables'

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

    const [custAllRes, custMonthRes, noContactRes, pipelineRes] = await Promise.all([
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('customers').select('*', { count: 'exact', head: true })
        .gte('ngay_lien_he_dau', mFrom).lte('ngay_lien_he_dau', mTo),
      supabase.from('customers').select('*', { count: 'exact', head: true })
        .or(`ngay_follow_up.is.null,ngay_follow_up.lt.${ago30}`)
        .not('pipeline', 'in', '("Từ chối","Bảo hành")'),
      supabase.from('customers').select('pipeline'),
    ])

    stats.total_customers     = custAllRes.count   ?? 0
    stats.new_customers_month = custMonthRes.count ?? 0
    stats.kh_no_contact_30d   = noContactRes.count ?? 0

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
