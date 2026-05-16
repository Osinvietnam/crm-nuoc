'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportManager {
  role: 'manager'
  thang: number; nam: number
  doanh_thu:    { tong: number }
  revenue_6months: { label: string; value: number }[]
  chi_phi:      { tong: number; opex: Record<string, number>; opex_tong: number; hoa_hong_da_tra: number; khau_hao: number }
  hoa_hong_chua_tra: number
  cong_no:      { tong: number; qua_han: number }
  loi_nhuan:    number
  bien_loi_nhuan_pct: number
}

interface ReportSales {
  role: 'sales'
  thang: number; nam: number
  doanh_thu: { da_thu: number; cho_thu: number; cho_thu_detail: { installment: number; amount: number; due_date: string }[] }
  hoa_hong:  { tong: number; da_tra: number; chua_tra: number; chi_tiet: { ma_hd: string; gia_tri_hd: number; hh_phan_tram: number; hh_kinh_doanh: number; hh_da_tra: boolean }[] }
}

interface Expense { id: number; category: string; amount: number; mo_ta: string | null }
interface Commission {
  id: number; ma_hd: string; gia_tri_hd: number
  hh_phan_tram: number; hh_kinh_doanh: number
  hh_da_tra: boolean; hh_ngay_tra: string | null
  ngay_ky: string | null
  staff: { full_name: string } | null
  customers: { ho_ten: string } | null
}
interface Asset {
  id: number; ten_tai_san: string; loai_tai_san: string
  gia_tri_ban_dau: number; ngay_mua: string
  thoi_gian_kh_thang: number; is_active: boolean; ghi_chu: string | null
  khau_hao_thang: number; gia_tri_con_lai: number; so_thang_con_lai: number; is_fully_depreciated: boolean
}
interface Receivable { amount: number; due_date: string; customer_name: string | null; installment: number }
interface PayRecord {
  id: number; customer_record_id: number | null; customer_name: string | null
  nguoi_phu_trach: string | null; installment: number; percent: number | null
  amount: number | null; due_date: string | null; paid_date: string | null
  is_paid: boolean; notes: string | null; proof_url: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('vi-VN').format(n) + 'đ'

const fmtShort = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ'
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(0) + ' tr'
  if (n >= 1_000)         return (n / 1_000).toFixed(0) + 'k'
  return String(n)
}

const CATEGORY_LABEL: Record<string, string> = {
  luong:          'Lương & BHXH',
  hang_hoa:       'Hàng hóa / COGS',
  van_chuyen:     'Vận chuyển & xăng',
  marketing:      'Marketing',
  thue_van_phong: 'Thuê VP & kho',
  khac:           'Chi phí khác',
}
const CATEGORIES = Object.keys(CATEGORY_LABEL)

const ASSET_TYPE_LABEL: Record<string, string> = {
  may_moc: 'Máy móc', xe_cong: 'Xe công', thiet_bi_van_phong: 'TB Văn phòng', khac: 'Khác',
}

type Tab = 'overview' | 'expenses' | 'commissions' | 'receivables' | 'assets' | 'payments'

// ─── Component ───────────────────────────────────────────────────────────────

export default function FinancePage() {
  const supabase = createClient()

  const now      = new Date()
  const [thang, setThang] = useState(now.getMonth() + 1)
  const [nam,   setNam]   = useState(now.getFullYear())
  const [tab,   setTab]   = useState<Tab>('overview')
  const [role,  setRole]  = useState<string>('')
  const [loading, setLoading] = useState(true)

  const [report,      setReport]      = useState<ReportManager | ReportSales | null>(null)
  const [expenses,    setExpenses]    = useState<Expense[]>([])
  const [expSummary,  setExpSummary]  = useState<Record<string, number>>({})
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [assets,      setAssets]      = useState<Asset[]>([])
  const [tong_kh,     setTongKh]      = useState(0)
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [selected,    setSelected]    = useState<Set<number>>(new Set())

  // Expense form state
  const [expForm, setExpForm] = useState<{ category: string; amount: string; mo_ta: string }>({ category: 'luong', amount: '', mo_ta: '' })
  const [expSaving, setExpSaving] = useState(false)

  // Asset form state
  const [assetForm, setAssetForm] = useState({ ten_tai_san: '', loai_tai_san: 'may_moc', gia_tri_ban_dau: '', ngay_mua: '', thoi_gian_kh_thang: '36', ghi_chu: '' })
  const [assetSaving, setAssetSaving] = useState(false)
  const [showAssetForm, setShowAssetForm] = useState(false)

  // Payments tab state
  const [paySearch, setPaySearch]     = useState('')
  const [payRecords, setPayRecords]   = useState<PayRecord[]>([])
  const [payLoading, setPayLoading]   = useState(false)
  const [payMarkingId, setPayMarkingId] = useState<number | null>(null)
  const [payPaidDate, setPayPaidDate] = useState(new Date().toISOString().split('T')[0])
  const [showPayForm, setShowPayForm] = useState(false)
  const [payForm, setPayForm] = useState({ customer_record_id: '', customer_name: '', installment: '1', amount: '', due_date: '', notes: '' })
  const [payFormSaving, setPayFormSaving] = useState(false)
  // Proof upload state
  const [proofPayId,     setProofPayId]     = useState<number | null>(null)
  const [proofFile,      setProofFile]      = useState<File | null>(null)
  const [proofUploading, setProofUploading] = useState(false)
  const [reportError,    setReportError]    = useState(false)

  // Fetch role once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setRole(data?.role ?? ''))
    })
  }, [])

  const isManager = ['admin', 'ceo', 'director', 'accountant'].includes(role)

  const fetchReport = useCallback(async () => {
    if (!role) return
    setLoading(true)
    setReportError(false)
    try {
      const res = await fetch(`/api/finance/report?thang=${thang}&nam=${nam}`)
      if (!res.ok) { setReportError(true); return }
      const json = await res.json()
      setReport(json)
    } catch {
      setReportError(true)
    } finally {
      setLoading(false)
    }
  }, [thang, nam, role])

  const fetchExpenses = useCallback(async () => {
    if (!isManager) return
    const res = await fetch(`/api/finance/expenses?thang=${thang}&nam=${nam}`)
    const json = await res.json()
    setExpenses(json.data ?? [])
    setExpSummary(json.summary ?? {})
  }, [thang, nam, isManager])

  const fetchCommissions = useCallback(async () => {
    if (!isManager) return
    const res = await fetch('/api/finance/commissions?is_paid=false')
    const json = await res.json()
    setCommissions(json.data ?? [])
  }, [isManager])

  const fetchAssets = useCallback(async () => {
    if (!isManager) return
    const res = await fetch('/api/finance/assets')
    const json = await res.json()
    setAssets(json.data ?? [])
    setTongKh(json.tong_khau_hao_thang ?? 0)
  }, [isManager])

  const fetchReceivables = useCallback(async () => {
    if (!isManager) return
    const res = await fetch('/api/payments?overdue=true')
    const json = await res.json()
    setReceivables(json.data ?? [])
  }, [isManager])

  useEffect(() => { if (role) fetchReport() }, [fetchReport])
  useEffect(() => { if (role && tab === 'expenses')    fetchExpenses()    }, [tab, fetchExpenses])
  useEffect(() => { if (role && tab === 'commissions') fetchCommissions() }, [tab, fetchCommissions])
  useEffect(() => { if (role && tab === 'assets')      fetchAssets()      }, [tab, fetchAssets])
  useEffect(() => { if (role && tab === 'receivables') fetchReceivables() }, [tab, fetchReceivables])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function saveExpense() {
    if (!expForm.amount) return
    setExpSaving(true)
    try {
      await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: expForm.category, amount: Number(expForm.amount.replace(/\D/g, '')), thang, nam, mo_ta: expForm.mo_ta || null }),
      })
      setExpForm({ category: 'luong', amount: '', mo_ta: '' })
      fetchExpenses()
      fetchReport()
    } finally {
      setExpSaving(false)
    }
  }

  async function deleteExpense(id: number) {
    if (!confirm('Xóa dòng chi phí này?')) return
    await fetch(`/api/finance/expenses?id=${id}`, { method: 'DELETE' })
    fetchExpenses()
    fetchReport()
  }

  async function markCommissionsPaid() {
    if (selected.size === 0) return
    const paid_date = new Date().toISOString().split('T')[0]
    await fetch('/api/finance/commissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_ids: Array.from(selected), paid_date }),
    })
    setSelected(new Set())
    fetchCommissions()
    fetchReport()
  }

  async function saveAsset() {
    if (!assetForm.ten_tai_san || !assetForm.gia_tri_ban_dau || !assetForm.ngay_mua) return
    setAssetSaving(true)
    try {
      await fetch('/api/finance/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...assetForm,
          gia_tri_ban_dau:    Number(assetForm.gia_tri_ban_dau.replace(/\D/g, '')),
          thoi_gian_kh_thang: Number(assetForm.thoi_gian_kh_thang),
        }),
      })
      setAssetForm({ ten_tai_san: '', loai_tai_san: 'may_moc', gia_tri_ban_dau: '', ngay_mua: '', thoi_gian_kh_thang: '36', ghi_chu: '' })
      setShowAssetForm(false)
      fetchAssets()
    } finally {
      setAssetSaving(false)
    }
  }

  async function deactivateAsset(id: number) {
    if (!confirm('Thanh lý tài sản này?')) return
    await fetch('/api/finance/assets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: false }),
    })
    fetchAssets()
  }

  async function searchPayments(q: string) {
    if (!q.trim()) { setPayRecords([]); return }
    setPayLoading(true)
    try {
      const res = await fetch(`/api/payments?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setPayRecords(json.data ?? [])
    } finally {
      setPayLoading(false)
    }
  }

  async function markAsPaid(id: number, proofUrl?: string) {
    setPayMarkingId(id)
    const body: Record<string, unknown> = { id, is_paid: true, paid_date: payPaidDate }
    if (proofUrl) body.proof_url = proofUrl
    const res = await fetch('/api/payments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setPayRecords(prev => prev.map(r =>
        r.id === id ? { ...r, is_paid: true, paid_date: payPaidDate, proof_url: proofUrl ?? r.proof_url } : r
      ))
      fetchReport()
    }
    setPayMarkingId(null)
    setProofPayId(null)
    setProofFile(null)
  }

  async function handleMarkWithProof() {
    if (!proofPayId) return
    setProofUploading(true)
    let proofUrl: string | undefined
    try {
      if (proofFile) {
        const fd = new FormData()
        fd.append('file', proofFile)
        fd.append('payment_id', String(proofPayId))
        const res = await fetch('/api/payments/proof', { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          proofUrl = data.url
        }
      }
      await markAsPaid(proofPayId, proofUrl)
    } catch {
      alert('Lỗi upload chứng từ, thử lại sau')
    } finally {
      setProofUploading(false)
    }
  }

  async function savePayRecord() {
    if (!payForm.customer_name || !payForm.amount) return
    setPayFormSaving(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_record_id: payForm.customer_record_id || undefined,
          customer_name:      payForm.customer_name,
          installment:        Number(payForm.installment),
          amount:             Number(payForm.amount.replace(/\D/g, '')),
          due_date:           payForm.due_date || null,
          notes:              payForm.notes || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        alert(json.error ?? 'Lưu thất bại')
        return
      }
      setPayForm({ customer_record_id: '', customer_name: '', installment: '1', amount: '', due_date: '', notes: '' })
      setShowPayForm(false)
      if (paySearch) searchPayments(paySearch)
    } finally {
      setPayFormSaving(false)
    }
  }

  // ── Month navigation ───────────────────────────────────────────────────────
  function prevMonth() {
    if (thang === 1) { setThang(12); setNam(n => n - 1) }
    else setThang(t => t - 1)
  }
  function nextMonth() {
    const isCurrentMonth = thang === now.getMonth() + 1 && nam === now.getFullYear()
    if (isCurrentMonth) return
    if (thang === 12) { setThang(1); setNam(n => n + 1) }
    else setThang(t => t + 1)
  }

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; managerOnly?: boolean; adminOnly?: boolean }[] = [
    { id: 'overview',     label: 'Tổng quan' },
    { id: 'payments',     label: 'Ghi thu',   managerOnly: true },
    { id: 'expenses',     label: 'Chi phí',   managerOnly: true },
    { id: 'commissions',  label: 'Hoa hồng',  managerOnly: true },
    { id: 'receivables',  label: 'Công nợ',   managerOnly: true },
    { id: 'assets',       label: 'Tài sản',   adminOnly: true },
  ]
  const visibleTabs = tabs.filter(t => {
    if (t.adminOnly)   return ['admin', 'ceo', 'director'].includes(role)
    if (t.managerOnly) return isManager
    return true
  })

  if (!role || loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="crm-spinner" />
    </div>
  )

  const r = report

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pb-24 px-4 pt-4 max-w-2xl mx-auto space-y-4">

      {/* Header + month picker */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Tài chính</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200">‹</button>
          <span className="text-sm font-semibold text-gray-700 w-20 text-center">T{thang}/{nam}</span>
          <button onClick={nextMonth} disabled={thang === now.getMonth() + 1 && nam === now.getFullYear()} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-30">›</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Error banner (UX-09) */}
      {reportError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">Không tải được báo cáo tài chính</p>
          <button onClick={fetchReport} className="text-xs text-red-600 font-semibold underline flex-shrink-0">Thử lại</button>
        </div>
      )}

      {/* ── Tab: Tổng quan ── */}
      {tab === 'overview' && r && isManager && (r as ReportManager).role === 'manager' && (() => {
        const m = r as ReportManager
        const cp = m.chi_phi
        return (
          <div className="space-y-3">
            {/* P&L Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3">
                <p className="text-white text-xs opacity-80">Doanh thu thực thu</p>
                <p className="text-white text-2xl font-bold">{fmtShort(m.doanh_thu.tong)}</p>
              </div>
              <div className="px-4 py-3 space-y-2">
                <Row label="Chi phí vận hành" value={fmt(cp.opex_tong)} sub />
                <Row label="Hoa hồng đã trả" value={fmt(cp.hoa_hong_da_tra)} sub />
                <Row label="Khấu hao" value={fmt(cp.khau_hao)} sub />
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Lợi nhuận</span>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${m.loi_nhuan >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {fmt(m.loi_nhuan)}
                    </span>
                    <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      m.loi_nhuan >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                    }`}>{m.bien_loi_nhuan_pct}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="grid grid-cols-2 gap-3">
              <AlertCard label="Hoa hồng chưa trả" value={fmt(m.hoa_hong_chua_tra)} color="orange"
                onClick={() => setTab('commissions')} />
              <AlertCard label="Công nợ quá hạn" value={fmt(m.cong_no.qua_han)} color="red"
                onClick={() => setTab('receivables')} />
            </div>

            {/* Revenue chart (simple bar) */}
            {m.revenue_6months.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-500 mb-3">Doanh thu 6 tháng</p>
                <SimpleBarChart data={m.revenue_6months} />
              </div>
            )}

            {/* Chi phí breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 mb-3">Chi phí tháng này</p>
              <div className="space-y-2">
                {CATEGORIES.map(cat => (
                  <div key={cat} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{CATEGORY_LABEL[cat]}</span>
                    <span className="text-sm font-medium text-gray-800">{fmt(cp.opex[cat] ?? 0)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm text-gray-500">Khấu hao</span>
                  <span className="text-sm font-medium text-gray-800">{fmt(cp.khau_hao)}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {tab === 'overview' && r && !isManager && (r as ReportSales).role === 'sales' && (() => {
        const s = r as ReportSales
        return (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-500 px-4 py-3">
                <p className="text-white text-xs opacity-80">Đã thu tháng này</p>
                <p className="text-white text-2xl font-bold">{fmtShort(s.doanh_thu.da_thu)}</p>
              </div>
              <div className="px-4 py-3 space-y-2">
                <Row label="Đang chờ thu" value={fmt(s.doanh_thu.cho_thu)} sub />
                {s.doanh_thu.cho_thu_detail.map((d, i) => (
                  <div key={i} className="ml-4 flex justify-between text-xs text-gray-500">
                    <span>Đợt {d.installment} — hạn {d.due_date}</span>
                    <span>{fmt(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 mb-3">Hoa hồng của tôi</p>
              <div className="space-y-2">
                <Row label="Tổng hoa hồng" value={fmt(s.hoa_hong.tong)} />
                <Row label="Đã trả" value={fmt(s.hoa_hong.da_tra)} sub />
                <Row label="Chưa trả" value={fmt(s.hoa_hong.chua_tra)} sub color={s.hoa_hong.chua_tra > 0 ? 'text-orange-600' : undefined} />
              </div>
              {s.hoa_hong.chi_tiet.length > 0 && (
                <div className="mt-3 space-y-1 border-t pt-3">
                  {s.hoa_hong.chi_tiet.map((o, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-600">
                      <span>{o.ma_hd} ({o.hh_phan_tram}%)</span>
                      <span className={o.hh_da_tra ? 'text-green-600' : 'text-orange-500'}>
                        {fmt(o.hh_kinh_doanh)} {o.hh_da_tra ? '✓' : '⏳'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Tab: Ghi thu ── */}
      {tab === 'payments' && isManager && (
        <div className="space-y-3">
          {/* Ngày thanh toán mặc định */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">Tìm kiếm công nợ theo tên KH</p>
              <button onClick={() => setShowPayForm(v => !v)} className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg">
                {showPayForm ? 'Đóng' : '+ Ghi thu mới'}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text" placeholder="Tên khách hàng..." value={paySearch}
                onChange={e => setPaySearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchPayments(paySearch)}
                className="crm-input flex-1"
              />
              <button onClick={() => searchPayments(paySearch)}
                className="bg-blue-600 text-white text-sm font-semibold px-4 rounded-xl">
                Tìm
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-28 flex-shrink-0">Ngày thanh toán</label>
              <input type="date" value={payPaidDate} onChange={e => setPayPaidDate(e.target.value)} className="crm-input flex-1" />
            </div>
          </div>

          {/* Form ghi thu mới */}
          {showPayForm && (
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-600">Ghi thu nhanh</p>
              <input placeholder="Tên khách hàng *" value={payForm.customer_name}
                onChange={e => setPayForm(f => ({ ...f, customer_name: e.target.value }))} className="crm-input w-full" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Đợt thanh toán</label>
                  <select value={payForm.installment} onChange={e => setPayForm(f => ({ ...f, installment: e.target.value }))} className="crm-input w-full">
                    <option value="1">Đợt 1</option>
                    <option value="2">Đợt 2</option>
                    <option value="3">Đợt 3</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Hạn thu</label>
                  <input type="date" value={payForm.due_date} onChange={e => setPayForm(f => ({ ...f, due_date: e.target.value }))} className="crm-input w-full" />
                </div>
              </div>
              <input placeholder="Số tiền (VNĐ) *" value={payForm.amount}
                onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} className="crm-input w-full" />
              <input placeholder="Ghi chú (tùy chọn)" value={payForm.notes}
                onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} className="crm-input w-full" />
              <button onClick={savePayRecord} disabled={payFormSaving || !payForm.customer_name || !payForm.amount} className="crm-btn-primary w-full">
                {payFormSaving ? 'Đang lưu...' : 'Lưu đợt thanh toán'}
              </button>
            </div>
          )}

          {/* Kết quả tìm kiếm */}
          {payLoading && <div className="flex justify-center py-6"><span className="crm-spinner" /></div>}
          {!payLoading && payRecords.length === 0 && paySearch && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">Không tìm thấy kết quả</div>
          )}
          {payRecords.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y">
              {payRecords.map(pr => (
                <div key={pr.id} className={`px-4 py-3 ${pr.is_paid ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{pr.customer_name ?? '—'}</p>
                      <p className="text-xs text-gray-500">
                        Đợt {pr.installment}
                        {pr.due_date ? ` · Hạn ${pr.due_date}` : ''}
                        {pr.nguoi_phu_trach ? ` · ${pr.nguoi_phu_trach}` : ''}
                      </p>
                      {pr.notes && <p className="text-xs text-gray-400 mt-0.5">{pr.notes}</p>}
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-800">{fmt(pr.amount)}</p>
                      {pr.is_paid ? (
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-xs text-green-600 font-medium">✓ Đã thu {pr.paid_date}</p>
                          {pr.proof_url ? (
                            <a href={pr.proof_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline">
                              📎 Xem chứng từ
                            </a>
                          ) : null}
                          <button
                            onClick={async () => {
                              const { downloadReceiptPDF } = await import('@/components/ReceiptPDF')
                              const company = await fetch('/api/admin/settings').then(r => r.json()).then(d => d.data ?? {})
                              await downloadReceiptPDF({
                                receipt_no:      `PT-${pr.id}`,
                                customer_name:   pr.customer_name ?? '—',
                                nguoi_phu_trach: pr.nguoi_phu_trach,
                                installment:     pr.installment,
                                amount:          pr.amount ?? 0,
                                paid_date:       pr.paid_date ?? new Date().toISOString().split('T')[0],
                                notes:           pr.notes,
                              }, company)
                            }}
                            className="text-xs text-blue-600 font-medium hover:underline"
                          >
                            Xuất biên lai
                          </button>
                        </div>
                      ) : proofPayId === pr.id ? (
                        /* ── Inline proof upload form ── */
                        <div className="mt-2 space-y-2 text-left min-w-[180px]">
                          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2 hover:border-blue-400 transition-colors">
                            <span className="flex-shrink-0">📎</span>
                            <span className="flex-1 truncate text-left">
                              {proofFile ? proofFile.name : 'Đính kèm chứng từ (tùy chọn)'}
                            </span>
                            <input type="file" className="hidden"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                          </label>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { setProofPayId(null); setProofFile(null) }}
                              className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50"
                            >
                              Bỏ qua
                            </button>
                            <button
                              onClick={handleMarkWithProof}
                              disabled={proofUploading}
                              className="flex-1 text-xs text-white bg-green-600 rounded-lg py-1.5 font-semibold disabled:opacity-50"
                            >
                              {proofUploading ? '...' : '✓ Xác nhận'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setProofPayId(pr.id)}
                          disabled={payMarkingId === pr.id}
                          className="mt-1 text-xs text-white bg-green-600 hover:bg-green-700 px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50"
                        >
                          {payMarkingId === pr.id ? '...' : 'Đánh dấu đã thu'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Chi phí ── */}
      {tab === 'expenses' && isManager && (
        <div className="space-y-3">
          {/* Form nhập chi phí */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500">Nhập chi phí tháng {thang}/{nam}</p>
            <select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}
              className="crm-input w-full">
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            <input type="text" placeholder="Số tiền (VNĐ)" value={expForm.amount}
              onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
              className="crm-input w-full" />
            <input type="text" placeholder="Ghi chú (tùy chọn)" value={expForm.mo_ta}
              onChange={e => setExpForm(f => ({ ...f, mo_ta: e.target.value }))}
              className="crm-input w-full" />
            <button onClick={saveExpense} disabled={expSaving || !expForm.amount}
              className="crm-btn-primary w-full">
              {expSaving ? 'Đang lưu...' : 'Lưu chi phí'}
            </button>
          </div>

          {/* Danh sách chi phí */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y">
            {CATEGORIES.map(cat => {
              const amt = expSummary[cat] ?? 0
              const rows = expenses.filter(e => e.category === cat)
              return (
                <div key={cat} className="px-4 py-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">{CATEGORY_LABEL[cat]}</span>
                    <span className={`text-sm font-semibold ${amt > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{fmt(amt)}</span>
                  </div>
                  {rows.map(e => (
                    <div key={e.id} className="mt-1 ml-2 flex justify-between items-center text-xs text-gray-500">
                      <span>{e.mo_ta || '—'}</span>
                      <div className="flex items-center gap-2">
                        <span>{fmt(e.amount)}</span>
                        {['admin', 'ceo', 'director'].includes(role) && (
                          <button onClick={() => deleteExpense(e.id)} className="text-red-400 hover:text-red-600">✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm font-bold text-gray-700">Tổng chi phí</span>
              <span className="text-sm font-bold text-red-500">{fmt(Object.values(expSummary).reduce((a, b) => a + b, 0))}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Hoa hồng ── */}
      {tab === 'commissions' && isManager && (
        <div className="space-y-3">
          {selected.size > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex justify-between items-center">
              <span className="text-sm text-orange-700">Đã chọn {selected.size} HĐ</span>
              <button onClick={markCommissionsPaid} className="text-sm font-semibold text-orange-700 bg-orange-100 px-3 py-1 rounded-lg hover:bg-orange-200">
                Đánh dấu đã trả
              </button>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y">
            {commissions.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Không có hoa hồng chưa trả</p>
            )}
            {commissions.map(c => (
              <label key={c.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(c.id)}
                  onChange={e => {
                    const s = new Set(selected)
                    e.target.checked ? s.add(c.id) : s.delete(c.id)
                    setSelected(s)
                  }}
                  className="mt-1 w-4 h-4 accent-blue-600" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.ma_hd}</p>
                      <p className="text-xs text-gray-500">{c.customers?.ho_ten} · {c.staff?.full_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-600">{fmt(c.hh_kinh_doanh)}</p>
                      <p className="text-xs text-gray-400">{c.hh_phan_tram}% / {fmt(c.gia_tri_hd)}</p>
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Công nợ ── */}
      {tab === 'receivables' && isManager && (
        <div className="space-y-3">
          {receivables.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center text-sm text-gray-400">
              Không có công nợ quá hạn
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y">
            {receivables.map((r, i) => {
              const daysPast = r.due_date ? Math.floor((Date.now() - new Date(r.due_date).getTime()) / 86_400_000) : 0
              const color = daysPast > 30 ? 'text-red-500' : daysPast > 7 ? 'text-orange-500' : 'text-yellow-600'
              return (
                <div key={i} className="px-4 py-3 flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.customer_name ?? '—'}</p>
                    <p className="text-xs text-gray-500">Đợt {r.installment} · Hạn {r.due_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{fmt(r.amount)}</p>
                    <p className={`text-xs font-medium ${color}`}>Quá {daysPast} ngày</p>
                  </div>
                </div>
              )
            })}
          </div>
          {receivables.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex justify-between">
              <span className="text-sm font-semibold text-red-700">Tổng quá hạn</span>
              <span className="text-sm font-bold text-red-700">{fmt(receivables.reduce((s, r) => s + (r.amount ?? 0), 0))}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Tài sản ── */}
      {tab === 'assets' && ['admin', 'ceo', 'director'].includes(role) && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">Khấu hao tháng: <span className="font-bold text-gray-800">{fmt(tong_kh)}</span></div>
            <button onClick={() => setShowAssetForm(!showAssetForm)} className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">
              + Thêm tài sản
            </button>
          </div>

          {showAssetForm && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500">Thêm tài sản mới</p>
              <input placeholder="Tên tài sản" value={assetForm.ten_tai_san} onChange={e => setAssetForm(f => ({ ...f, ten_tai_san: e.target.value }))} className="crm-input w-full" />
              <select value={assetForm.loai_tai_san} onChange={e => setAssetForm(f => ({ ...f, loai_tai_san: e.target.value }))} className="crm-input w-full">
                {Object.entries(ASSET_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input placeholder="Giá trị ban đầu (VNĐ)" value={assetForm.gia_tri_ban_dau} onChange={e => setAssetForm(f => ({ ...f, gia_tri_ban_dau: e.target.value }))} className="crm-input w-full" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ngày mua</label>
                  <input type="date" value={assetForm.ngay_mua} onChange={e => setAssetForm(f => ({ ...f, ngay_mua: e.target.value }))} className="crm-input w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Kỳ KH (tháng)</label>
                  <input type="number" value={assetForm.thoi_gian_kh_thang} onChange={e => setAssetForm(f => ({ ...f, thoi_gian_kh_thang: e.target.value }))} className="crm-input w-full" />
                </div>
              </div>
              <input placeholder="Ghi chú (tùy chọn)" value={assetForm.ghi_chu} onChange={e => setAssetForm(f => ({ ...f, ghi_chu: e.target.value }))} className="crm-input w-full" />
              <button onClick={saveAsset} disabled={assetSaving} className="crm-btn-primary w-full">
                {assetSaving ? 'Đang lưu...' : 'Thêm tài sản'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {assets.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center text-sm text-gray-400">Chưa có tài sản</div>
            )}
            {assets.map(a => (
              <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{a.ten_tai_san}</p>
                    <p className="text-xs text-gray-500">{ASSET_TYPE_LABEL[a.loai_tai_san]} · Mua {a.ngay_mua}</p>
                  </div>
                  {['admin', 'ceo', 'director'].includes(role) && (
                    <button onClick={() => deactivateAsset(a.id)} className="text-xs text-gray-400 hover:text-red-500">Thanh lý</button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <ProgressRow label="Giá trị ban đầu" value={fmt(a.gia_tri_ban_dau)} />
                  <ProgressRow label="Giá trị còn lại" value={fmt(a.gia_tri_con_lai)}
                    pct={a.gia_tri_ban_dau > 0 ? Math.round(a.gia_tri_con_lai / a.gia_tri_ban_dau * 100) : 0} />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Khấu hao/tháng: <span className="font-medium text-gray-700">{fmt(a.khau_hao_thang)}</span></span>
                    <span>{a.is_fully_depreciated ? '✅ Đã khấu hao xong' : `Còn ${a.so_thang_con_lai} tháng`}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, value, sub, color }: { label: string; value: string; sub?: boolean; color?: string }) {
  return (
    <div className={`flex justify-between items-center ${sub ? 'ml-2' : ''}`}>
      <span className={`${sub ? 'text-xs text-gray-500' : 'text-sm text-gray-600'}`}>{label}</span>
      <span className={`${sub ? 'text-xs' : 'text-sm font-semibold'} ${color ?? 'text-gray-800'}`}>{value}</span>
    </div>
  )
}

function AlertCard({ label, value, color, onClick }: { label: string; value: string; color: 'orange' | 'red'; onClick: () => void }) {
  const cls = color === 'red'
    ? 'bg-red-50 border-red-100 text-red-700'
    : 'bg-orange-50 border-orange-100 text-orange-700'
  return (
    <button onClick={onClick} className={`rounded-xl border p-3 text-left w-full hover:opacity-80 transition-opacity ${cls}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </button>
  )
}

function ProgressRow({ label, value, pct }: { label: string; value: string; pct?: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
        <span>{label}</span><span className="font-medium text-gray-700">{value}</span>
      </div>
      {pct != null && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

function SimpleBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] text-gray-400">{d.value > 0 ? fmtShort(d.value) : ''}</span>
          <div
            className={`w-full rounded-t-sm transition-all ${i === data.length - 1 ? 'bg-blue-500' : 'bg-blue-200'}`}
            style={{ height: `${Math.max(4, Math.round((d.value / max) * 48))}px` }}
          />
          <span className="text-[9px] text-gray-400">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

