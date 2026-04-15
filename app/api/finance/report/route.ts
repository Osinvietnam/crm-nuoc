import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/finance/report?thang=4&nam=2026 ─────────────────────────────────
// Manager (admin/ceo/accountant): P&L đầy đủ
// Sales: chỉ doanh thu + hoa hồng của mình

function monthRange(thang: number, nam: number) {
  const from = new Date(nam, thang - 1, 1).toISOString().split('T')[0]
  const to   = new Date(nam, thang, 0).toISOString().split('T')[0]
  return { from, to }
}

function monthsElapsed(ngay_mua: string): number {
  const purchase = new Date(ngay_mua)
  const now      = new Date()
  return Math.max(0,
    (now.getFullYear() - purchase.getFullYear()) * 12 +
    (now.getMonth() - purchase.getMonth())
  )
}

// Last 6 months labels for chart
function last6(thang: number, nam: number) {
  const result: { label: string; thang: number; nam: number }[] = []
  for (let i = 5; i >= 0; i--) {
    let m = thang - i
    let y = nam
    if (m <= 0) { m += 12; y -= 1 }
    result.push({ label: `T${m}/${String(y).slice(2)}`, thang: m, nam: y })
  }
  return result
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isManager = ['admin', 'ceo', 'accountant'].includes(me.role)
    const isSales   = me.role === 'sales'
    if (!isManager && !isSales) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const thang = Number(req.nextUrl.searchParams.get('thang') ?? new Date().getMonth() + 1)
    const nam   = Number(req.nextUrl.searchParams.get('nam')   ?? new Date().getFullYear())
    const { from, to } = monthRange(thang, nam)

    const service = createServiceClient()

    // ── 1. Doanh thu từ payment_records ───────────────────────────────────────
    let revQuery = service
      .from('payment_records')
      .select('amount, nguoi_phu_trach, contract_record_id')
      .eq('is_paid', true)
      .gte('paid_date', from)
      .lte('paid_date', to)

    if (isSales) revQuery = revQuery.eq('nguoi_phu_trach', me.full_name)

    const { data: payments } = await revQuery
    const doanh_thu_tong = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)

    // ── 2. Doanh thu 6 tháng gần nhất (manager only) ──────────────────────────
    let revenue_6months: { label: string; value: number }[] = []
    if (isManager) {
      const oldest = last6(thang, nam)[0]
      const oldFrom = monthRange(oldest.thang, oldest.nam).from
      const { data: pay6m } = await service
        .from('payment_records')
        .select('amount, paid_date')
        .eq('is_paid', true)
        .gte('paid_date', oldFrom)
        .lte('paid_date', to)

      const buckets = last6(thang, nam)
      const map: Record<string, number> = {}
      for (const b of buckets) map[b.label] = 0
      for (const p of pay6m ?? []) {
        const d  = new Date(p.paid_date)
        const lbl = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`
        if (lbl in map) map[lbl] += p.amount ?? 0
      }
      revenue_6months = buckets.map(b => ({ label: b.label, value: map[b.label] }))
    }

    if (isSales) {
      // Sales: doanh thu đang chờ thu + hoa hồng của mình
      const { data: pending } = await service
        .from('payment_records')
        .select('amount, installment, due_date')
        .eq('is_paid', false)
        .eq('nguoi_phu_trach', me.full_name)

      const { data: commOrders } = await service
        .from('orders')
        .select('hh_kinh_doanh, hh_phan_tram, hh_da_tra, ma_hd, gia_tri_hd')
        .eq('type', 'b2c')
        .eq('nguoi_phu_trach', me.id)
        .gt('hh_kinh_doanh', 0)

      return NextResponse.json({
        role: 'sales',
        thang, nam,
        doanh_thu: {
          da_thu: doanh_thu_tong,
          cho_thu: (pending ?? []).reduce((s, p) => s + (p.amount ?? 0), 0),
          cho_thu_detail: (pending ?? []).map(p => ({
            installment: p.installment,
            amount: p.amount,
            due_date: p.due_date,
          })),
        },
        hoa_hong: {
          tong:        (commOrders ?? []).reduce((s, o) => s + (o.hh_kinh_doanh ?? 0), 0),
          da_tra:      (commOrders ?? []).filter(o => o.hh_da_tra).reduce((s, o) => s + (o.hh_kinh_doanh ?? 0), 0),
          chua_tra:    (commOrders ?? []).filter(o => !o.hh_da_tra).reduce((s, o) => s + (o.hh_kinh_doanh ?? 0), 0),
          chi_tiet:    (commOrders ?? []).map(o => ({
            ma_hd: o.ma_hd,
            gia_tri_hd: o.gia_tri_hd,
            hh_phan_tram: o.hh_phan_tram,
            hh_kinh_doanh: o.hh_kinh_doanh,
            hh_da_tra: o.hh_da_tra,
          })),
        },
      })
    }

    // ── Manager: P&L đầy đủ ───────────────────────────────────────────────────

    // 3. Chi phí vận hành từ expenses table
    const { data: expenses } = await service
      .from('expenses')
      .select('category, amount')
      .eq('thang', thang)
      .eq('nam', nam)

    const opex: Record<string, number> = {}
    let opex_tong = 0
    for (const e of expenses ?? []) {
      opex[e.category] = (opex[e.category] ?? 0) + (e.amount ?? 0)
      opex_tong += e.amount ?? 0
    }

    // 4. Hoa hồng đã trả trong tháng
    const { data: commPaid } = await service
      .from('orders')
      .select('hh_kinh_doanh')
      .eq('type', 'b2c')
      .eq('hh_da_tra', true)
      .gte('hh_ngay_tra', from)
      .lte('hh_ngay_tra', to)

    const hoa_hong_da_tra = (commPaid ?? []).reduce((s, o) => s + (o.hh_kinh_doanh ?? 0), 0)

    // Tổng hoa hồng chưa trả (toàn bộ, không theo tháng)
    const { data: commUnpaid } = await service
      .from('orders')
      .select('hh_kinh_doanh')
      .eq('type', 'b2c')
      .eq('hh_da_tra', false)
      .gt('hh_kinh_doanh', 0)

    const hoa_hong_chua_tra = (commUnpaid ?? []).reduce((s, o) => s + (o.hh_kinh_doanh ?? 0), 0)

    // 5. Khấu hao tháng từ assets (tài sản còn hoạt động, chưa hết kỳ)
    const { data: assets } = await service
      .from('assets')
      .select('gia_tri_ban_dau, ngay_mua, thoi_gian_kh_thang')
      .eq('is_active', true)
      .lte('ngay_mua', to)

    let khau_hao_thang = 0
    for (const a of assets ?? []) {
      const elapsed = monthsElapsed(a.ngay_mua)
      if (elapsed < a.thoi_gian_kh_thang) {
        khau_hao_thang += Math.round(a.gia_tri_ban_dau / a.thoi_gian_kh_thang)
      }
    }

    // 6. Công nợ chưa thu (toàn bộ)
    const { data: unpaid } = await service
      .from('payment_records')
      .select('amount, due_date, customer_name')
      .eq('is_paid', false)

    const cong_no_tong = (unpaid ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
    const today = new Date().toISOString().split('T')[0]
    const cong_no_qua_han = (unpaid ?? [])
      .filter(p => p.due_date && p.due_date < today)
      .reduce((s, p) => s + (p.amount ?? 0), 0)

    // 7. P&L tổng hợp
    const chi_phi_tong = opex_tong + hoa_hong_da_tra + khau_hao_thang
    const loi_nhuan    = doanh_thu_tong - chi_phi_tong
    const bien_loi_nhuan_pct = doanh_thu_tong > 0
      ? Math.round((loi_nhuan / doanh_thu_tong) * 1000) / 10
      : 0

    return NextResponse.json({
      role: 'manager',
      thang, nam,
      doanh_thu: {
        tong: doanh_thu_tong,
      },
      revenue_6months,
      chi_phi: {
        tong:          chi_phi_tong,
        opex:          opex,
        opex_tong,
        hoa_hong_da_tra,
        khau_hao:      khau_hao_thang,
      },
      hoa_hong_chua_tra,
      cong_no: {
        tong:     cong_no_tong,
        qua_han:  cong_no_qua_han,
      },
      loi_nhuan,
      bien_loi_nhuan_pct,
    })
  } catch (err) {
    console.error('GET /api/finance/report:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
