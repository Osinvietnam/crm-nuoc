import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listRecords, listAllRecords } from '@/lib/lark/client'
import { TABLES, PIPELINE_STAGES } from '@/lib/lark/tables'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthRevenue { label: string; value: number }

export interface DashboardStats {
  // Base (mọi role)
  total_customers:      number
  new_customers_month:  number
  pending_quotes:       number
  orders_month:         number
  maintenance_today:    number
  pipeline:             Record<string, number>

  // Manager group (admin/ceo/tech_lead/accountant)
  revenue_month:        number
  revenue_6months:      MonthRevenue[]
  contracts_unpaid:     number

  // Tech
  maintenance_week:     number
  construction_ongoing: number
  maintenance_overdue:  number

  // Logistics
  logistics_pending:        number
  logistics_delivering:     number
  logistics_delivered_month: number
  logistics_overdue:        number

  // Alerts
  kh_no_contact_30d: number
  quotes_stale:      number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthRange(offsetMonths = 0) {
  const now  = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1).getTime()
  const to   = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0, 23, 59, 59, 999).getTime()
  return { from, to }
}

function todayRange() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return { start, end: start + 86_399_999 }
}

function weekRange() {
  const now   = new Date()
  const day   = now.getDay() || 7                        // Mon=1 … Sun=7
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1).getTime()
  const end   = start + 7 * 86_400_000 - 1
  return { start, end }
}

function last6Months(): MonthRevenue[] {
  const months: MonthRevenue[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      label: `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`,
      value: 0,
    })
  }
  return months
}

function monthLabel(ts: number) {
  const d = new Date(ts)
  return `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`
}

const zero = (): DashboardStats => ({
  total_customers: 0, new_customers_month: 0, pending_quotes: 0,
  orders_month: 0, maintenance_today: 0, pipeline: {},
  revenue_month: 0, revenue_6months: last6Months(), contracts_unpaid: 0,
  maintenance_week: 0, construction_ongoing: 0, maintenance_overdue: 0,
  logistics_pending: 0, logistics_delivering: 0, logistics_delivered_month: 0, logistics_overdue: 0,
  kh_no_contact_30d: 0, quotes_stale: 0,
})

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const { role, full_name } = profile
    const isManagerGroup = ['admin', 'ceo', 'tech_lead', 'accountant'].includes(role)
    const isSales        = role === 'sales' || role === 'partner'
    const isTech         = role === 'tech'
    const isLogistics    = role === 'logistics'

    const own = (field: string) => `CurrentValue.[${field}] = "${full_name}"`
    const { from, to }   = monthRange()
    const { start, end } = todayRange()
    const { start: wStart, end: wEnd } = weekRange()
    const thirtyDaysAgo  = Date.now() - 30 * 86_400_000

    const stats = zero()

    // ── A. Khách hàng ─────────────────────────────────────────────────────────
    const custFilter = isSales ? own('Người phụ trách') : undefined

    const [custTotal, custMonth, allCust] = await Promise.all([
      listRecords(TABLES.CUSTOMERS, { pageSize: 1, filter: custFilter }),
      listRecords(TABLES.CUSTOMERS, {
        pageSize: 1,
        filter: [custFilter, `CurrentValue.[Ngày liên hệ đầu] >= ${from}`, `CurrentValue.[Ngày liên hệ đầu] <= ${to}`]
          .filter(Boolean).join(' && '),
      }),
      listAllRecords(TABLES.CUSTOMERS, custFilter),
    ])

    stats.total_customers     = custTotal.total
    stats.new_customers_month = custMonth.total

    // Pipeline
    for (const stage of PIPELINE_STAGES) stats.pipeline[stage] = 0
    for (const r of allCust) {
      const s = String(r.fields['Trạng thái pipeline'] ?? '')
      if (s in stats.pipeline) stats.pipeline[s]++
    }

    // KH chưa liên hệ 30 ngày
    const noContactFilter = [
      custFilter,
      `CurrentValue.[Ngày cập nhật cuối] < ${thirtyDaysAgo}`,
    ].filter(Boolean).join(' && ')
    const noContact = await listRecords(TABLES.CUSTOMERS, { pageSize: 1, filter: noContactFilter })
    stats.kh_no_contact_30d = noContact.total

    // ── B. Báo giá ────────────────────────────────────────────────────────────
    if (!isLogistics && !isTech) {
      const quoteOwner = isSales ? own('Người phụ trách') : undefined
      const statusOr   = `(CurrentValue.[Trạng thái] = "Nháp" || CurrentValue.[Trạng thái] = "Đã gửi")`
      const pendingFilter = quoteOwner ? `${statusOr} && ${quoteOwner}` : statusOr
      const staleFilter   = quoteOwner
        ? `CurrentValue.[Trạng thái] = "Đã gửi" && ${quoteOwner}`
        : `CurrentValue.[Trạng thái] = "Đã gửi"`

      const [pq, stale] = await Promise.all([
        listRecords(TABLES.QUOTES, { pageSize: 1, filter: pendingFilter }),
        listRecords(TABLES.QUOTES,  { pageSize: 1, filter: staleFilter }),
      ])
      stats.pending_quotes = pq.total
      stats.quotes_stale   = stale.total
    }

    // ── C. Đơn hàng tháng ────────────────────────────────────────────────────
    if (!isTech) {
      const orderOwner = (isSales && role !== 'partner') ? own('Người phụ trách') : undefined
      const [contracts, commercial] = await Promise.all([
        listRecords(TABLES.CONTRACTS, {
          pageSize: 1,
          filter: [orderOwner, `CurrentValue.[Ngày ký] >= ${from}`, `CurrentValue.[Ngày ký] <= ${to}`]
            .filter(Boolean).join(' && ') || undefined,
        }),
        listRecords(TABLES.COMMERCIAL, {
          pageSize: 1,
          filter: [orderOwner, `CurrentValue.[Ngày giao thực] >= ${from}`, `CurrentValue.[Ngày giao thực] <= ${to}`]
            .filter(Boolean).join(' && ') || undefined,
        }),
      ])
      stats.orders_month = contracts.total + commercial.total
    }

    // ── D. Bảo trì ───────────────────────────────────────────────────────────
    if (!isLogistics) {
      const techFilter = isTech ? own('KTV phụ trách') : undefined
      const nvFilter   = isTech ? own('NV phụ trách')  : undefined

      const [ctToday, ptToday, ptWeek, ctOngoing, ptOverdue] = await Promise.all([
        listRecords(TABLES.CONSTRUCTION, {
          pageSize: 1,
          filter: [techFilter, `CurrentValue.[Ngày nghiệm thu dự kiến] >= ${start}`, `CurrentValue.[Ngày nghiệm thu dự kiến] <= ${end}`]
            .filter(Boolean).join(' && ') || undefined,
        }),
        listRecords(TABLES.PERIODIC_SERVICE, {
          pageSize: 1,
          filter: [nvFilter, `CurrentValue.[Lần BĐ tiếp theo] >= ${start}`, `CurrentValue.[Lần BĐ tiếp theo] <= ${end}`]
            .filter(Boolean).join(' && ') || undefined,
        }),
        listRecords(TABLES.PERIODIC_SERVICE, {
          pageSize: 1,
          filter: [nvFilter, `CurrentValue.[Lần BĐ tiếp theo] >= ${wStart}`, `CurrentValue.[Lần BĐ tiếp theo] <= ${wEnd}`]
            .filter(Boolean).join(' && ') || undefined,
        }),
        listRecords(TABLES.CONSTRUCTION, {
          pageSize: 1,
          filter: `CurrentValue.[Trạng thái thi công] = "Đang thi công"`,
        }),
        listRecords(TABLES.PERIODIC_SERVICE, {
          pageSize: 1,
          filter: [nvFilter, `CurrentValue.[Lần BĐ tiếp theo] < ${start}`]
            .filter(Boolean).join(' && ') || undefined,
        }),
      ])

      stats.maintenance_today    = ctToday.total + ptToday.total
      stats.maintenance_week     = ctToday.total + ptWeek.total
      stats.construction_ongoing = ctOngoing.total
      stats.maintenance_overdue  = ptOverdue.total
    }

    // ── E. Revenue (manager group) ────────────────────────────────────────────
    if (isManagerGroup) {
      // Tháng hiện tại: contracts + commercial
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)
      sixMonthsAgo.setHours(0, 0, 0, 0)

      const [allContracts6M, allCommercial6M, unpaid] = await Promise.all([
        listAllRecords(TABLES.CONTRACTS,
          `CurrentValue.[Ngày ký] >= ${sixMonthsAgo.getTime()}`,
        ),
        listAllRecords(TABLES.COMMERCIAL,
          `CurrentValue.[Ngày giao thực] >= ${sixMonthsAgo.getTime()}`,
        ),
        // HĐ chưa thanh toán: các đợt chờ TT
        listRecords(TABLES.CONTRACTS, {
          pageSize: 1,
          filter: `(CurrentValue.[Trạng thái HĐ] = "Đã ký - Chờ TT đợt 1" || CurrentValue.[Trạng thái HĐ] = "Đã ký - Chờ TT đợt 2" || CurrentValue.[Trạng thái HĐ] = "Đã ký - Chờ TT đợt 3")`,
        }),
      ])

      stats.contracts_unpaid = unpaid.total

      // Build 6-month revenue
      const months = last6Months()
      const monthMap: Record<string, number> = {}
      for (const m of months) monthMap[m.label] = 0

      for (const r of allContracts6M) {
        const ts = r.fields['Ngày ký'] ? Number(r.fields['Ngày ký']) : null
        if (!ts) continue
        const label = monthLabel(ts)
        if (label in monthMap) {
          monthMap[label] += Number(r.fields['Giá trị HĐ (VNĐ)'] ?? 0)
        }
      }
      for (const r of allCommercial6M) {
        const ts = r.fields['Ngày giao thực'] ? Number(r.fields['Ngày giao thực']) : null
        if (!ts) continue
        const label = monthLabel(ts)
        if (label in monthMap) {
          monthMap[label] += Number(r.fields['Tổng tiền (VNĐ)'] ?? 0)
        }
      }

      const currentMonthLabel = monthLabel(Date.now())
      stats.revenue_month   = monthMap[currentMonthLabel] ?? 0
      stats.revenue_6months = months.map(m => ({ label: m.label, value: monthMap[m.label] ?? 0 }))
    }

    // ── F. Logistics ──────────────────────────────────────────────────────────
    if (isLogistics || isManagerGroup) {
      const [lPending, lDelivering, lDelivered, lOverdue] = await Promise.all([
        listRecords(TABLES.COMMERCIAL, {
          pageSize: 1,
          filter: `(CurrentValue.[Trạng thái đơn] = "Chờ xác nhận" || CurrentValue.[Trạng thái đơn] = "Đang chuẩn bị")`,
        }),
        listRecords(TABLES.COMMERCIAL, {
          pageSize: 1,
          filter: `CurrentValue.[Trạng thái đơn] = "Đang giao"`,
        }),
        listRecords(TABLES.COMMERCIAL, {
          pageSize: 1,
          filter: [
            `(CurrentValue.[Trạng thái đơn] = "Đã giao" || CurrentValue.[Trạng thái đơn] = "Đã thanh toán")`,
            `CurrentValue.[Ngày giao thực] >= ${from}`,
            `CurrentValue.[Ngày giao thực] <= ${to}`,
          ].join(' && '),
        }),
        listRecords(TABLES.COMMERCIAL, {
          pageSize: 1,
          filter: [
            `CurrentValue.[Ngày giao hàng DK] < ${start}`,
            `(CurrentValue.[Trạng thái đơn] = "Chờ xác nhận" || CurrentValue.[Trạng thái đơn] = "Đang chuẩn bị" || CurrentValue.[Trạng thái đơn] = "Đang giao")`,
          ].join(' && '),
        }),
      ])

      stats.logistics_pending         = lPending.total
      stats.logistics_delivering      = lDelivering.total
      stats.logistics_delivered_month = lDelivered.total
      stats.logistics_overdue         = lOverdue.total
    }

    return NextResponse.json({ data: stats, role })
  } catch (err) {
    console.error('GET /api/dashboard/stats:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
