import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/kpi/me?month=&year=&userId= ────────────────────────────────────
// Trả về: target + actual + performance% cho một nhân viên trong tháng
// userId: tùy chọn — admin/CEO có thể xem của người khác; còn lại chỉ xem của mình

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const month  = Number(req.nextUrl.searchParams.get('month')  ?? new Date().getMonth() + 1)
    const year   = Number(req.nextUrl.searchParams.get('year')   ?? new Date().getFullYear())
    const userId = req.nextUrl.searchParams.get('userId') ?? user.id

    // Chỉ admin/CEO mới xem được của người khác
    const isManager = ['admin', 'ceo'].includes(me.role)
    if (userId !== user.id && !isManager) {
      return NextResponse.json({ error: 'Không có quyền xem KPI của người khác' }, { status: 403 })
    }

    const service = createServiceClient()

    // Lấy target
    const { data: targetRow } = await service
      .from('kpi_targets')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year)
      .single()

    // Lấy full_name của nhân viên (để match với payment_records.nguoi_phu_trach)
    const { data: targetProfile } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()

    const fullName = targetProfile?.full_name ?? ''

    // ── Actual revenue: tổng tiền thực thu trong tháng ──
    // payment_records.amount WHERE is_paid=true AND paid_date trong tháng AND nguoi_phu_trach = fullName
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd   = new Date(year, month, 0).toISOString().split('T')[0] // ngày cuối tháng

    const { data: payments } = await service
      .from('payment_records')
      .select('amount')
      .eq('is_paid', true)
      .eq('nguoi_phu_trach', fullName)
      .gte('paid_date', monthStart)
      .lte('paid_date', monthEnd)

    const actualRevenue = (payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)

    // ── Actual contracts: số KH có pipeline ≥ Chốt HĐ, phụ trách = fullName, cập nhật trong tháng ──
    // Dùng LarkBase customers: đếm records có pipeline trong danh sách stages sau Chốt HĐ
    // Để tránh gọi LarkBase nặng, dùng Supabase nếu có snapshot; nếu không thì trả null
    // → Hiện tại chưa có bảng mirror customers trong Supabase nên trả null (sẽ cải thiện sau)
    const actualContracts: number | null = null

    // ── Actual customers: số KH mới trong tháng, phụ trách = fullName ──
    // Tương tự — cần mirror customers → trả null tạm thời
    const actualCustomers: number | null = null

    // ── Performance % ──
    const target = targetRow ?? null
    const perf = {
      revenue:   target?.target_revenue   ? Math.round((actualRevenue / target.target_revenue) * 100) : null,
      contracts: null as number | null,
      customers: null as number | null,
    }

    return NextResponse.json({
      month,
      year,
      user_id:   userId,
      user_name: fullName,
      target,
      actual: {
        revenue:   actualRevenue,
        contracts: actualContracts,
        customers: actualCustomers,
      },
      performance: perf,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('GET /api/kpi/me:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
