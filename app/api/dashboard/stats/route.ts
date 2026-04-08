import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listRecords, listAllRecords } from '@/lib/lark/client'
import { TABLES, PIPELINE_STAGES } from '@/lib/lark/tables'

export interface DashboardStats {
  total_customers:   number
  new_customers_month: number
  pending_quotes:    number
  orders_month:      number
  maintenance_today: number
  pipeline:          Record<string, number>
}

// Đầu và cuối tháng hiện tại dưới dạng ms timestamp
function currentMonthRange() {
  const now  = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
  return { from, to }
}

// Đầu và cuối ngày hôm nay dưới dạng ms timestamp
function todayRange() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end   = start + 86399999
  return { start, end }
}

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

    const isSales   = profile.role === 'sales'
    const isTech    = profile.role === 'tech'
    const ownerFilter = (field: string) =>
      `CurrentValue.[${field}] = "${profile.full_name}"`

    // ── 1. Tổng khách hàng ────────────────────────────────────────────────────
    const customerFilter = isSales
      ? ownerFilter('Người phụ trách')
      : undefined

    const [customerResult] = await Promise.all([
      listRecords(TABLES.CUSTOMERS, { pageSize: 1, filter: customerFilter }),
    ])
    const total_customers = customerResult.total

    // ── 2. KH mới trong tháng ─────────────────────────────────────────────────
    const { from, to } = currentMonthRange()
    // LarkBase date filter: dùng >= và <= với ms timestamp
    const newCustFilter = [
      customerFilter,
      `CurrentValue.[Ngày liên hệ đầu] >= ${from}`,
      `CurrentValue.[Ngày liên hệ đầu] <= ${to}`,
    ].filter(Boolean).join(' && ')

    const newCustResult = await listRecords(TABLES.CUSTOMERS, {
      pageSize: 1,
      filter:   newCustFilter,
    })
    const new_customers_month = newCustResult.total

    // ── 3. Báo giá đang chờ (Nháp + Gửi KH) ─────────────────────────────────
    const quoteBaseFilter = isSales ? ownerFilter('Người phụ trách') : undefined
    // Lark OR filter syntax: (A || B) && C
    const pendingStatuses = ['Nháp', 'Gửi KH']
    const statusOr = pendingStatuses
      .map(s => `CurrentValue.[Trạng thái] = "${s}"`)
      .join(' || ')
    const pendingQuoteFilter = quoteBaseFilter
      ? `(${statusOr}) && ${quoteBaseFilter}`
      : `(${statusOr})`

    const pendingQuoteResult = await listRecords(TABLES.QUOTES, {
      pageSize: 1,
      filter:   pendingQuoteFilter,
    })
    const pending_quotes = pendingQuoteResult.total

    // ── 4. Hợp đồng + đơn thương mại trong tháng ─────────────────────────────
    const orderOwner = isSales ? ownerFilter('Người phụ trách') : undefined
    const contractMonthFilter = [
      orderOwner,
      `CurrentValue.[Ngày ký HĐ] >= ${from}`,
      `CurrentValue.[Ngày ký HĐ] <= ${to}`,
    ].filter(Boolean).join(' && ')

    const commercialMonthFilter = [
      orderOwner,
      `CurrentValue.[Ngày tạo] >= ${from}`,
      `CurrentValue.[Ngày tạo] <= ${to}`,
    ].filter(Boolean).join(' && ')

    const [contractResult, commercialResult] = await Promise.all([
      listRecords(TABLES.CONTRACTS, { pageSize: 1, filter: contractMonthFilter || undefined }),
      listRecords(TABLES.COMMERCIAL, { pageSize: 1, filter: commercialMonthFilter || undefined }),
    ])
    const orders_month = contractResult.total + commercialResult.total

    // ── 5. Bảo trì hôm nay ───────────────────────────────────────────────────
    const { start, end } = todayRange()
    const techFilter = isTech ? ownerFilter('KTV phụ trách') : undefined
    const constructionTodayFilter = [
      techFilter,
      `CurrentValue.[Ngày nghiệm thu dự kiến] >= ${start}`,
      `CurrentValue.[Ngày nghiệm thu dự kiến] <= ${end}`,
    ].filter(Boolean).join(' && ')

    const periodicTodayFilter = [
      isTech ? ownerFilter('NV phụ trách') : undefined,
      `CurrentValue.[Ngày bảo trì dự kiến] >= ${start}`,
      `CurrentValue.[Ngày bảo trì dự kiến] <= ${end}`,
    ].filter(Boolean).join(' && ')

    const [constructionResult, periodicResult] = await Promise.all([
      listRecords(TABLES.CONSTRUCTION, { pageSize: 1, filter: constructionTodayFilter || undefined }),
      listRecords(TABLES.PERIODIC_SERVICE, { pageSize: 1, filter: periodicTodayFilter || undefined }),
    ])
    const maintenance_today = constructionResult.total + periodicResult.total

    // ── 6. Phân bổ pipeline ───────────────────────────────────────────────────
    // Fetch tất cả customers, group theo pipeline stage
    const allCustomers = await listAllRecords(TABLES.CUSTOMERS, customerFilter)
    const pipeline: Record<string, number> = {}
    for (const stage of PIPELINE_STAGES) pipeline[stage] = 0

    for (const r of allCustomers) {
      const stage = String(r.fields['Trạng thái pipeline'] ?? '')
      if (stage in pipeline) pipeline[stage]++
    }

    const stats: DashboardStats = {
      total_customers,
      new_customers_month,
      pending_quotes,
      orders_month,
      maintenance_today,
      pipeline,
    }

    return NextResponse.json({ data: stats })
  } catch (err) {
    console.error('GET /api/dashboard/stats:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
