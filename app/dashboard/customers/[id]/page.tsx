'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PIPELINE_STAGES, PIPELINE_COLORS, PRIORITY_COLORS, QUOTE_STATUS_COLORS, NGUON_KH_OPTIONS } from '@/lib/lark/tables'
import type { Customer } from '@/app/api/lark/customers/route'
import type { Quote } from '@/app/api/lark/quotes/_mappers'
import { useQuoteItems, itemsToLarkFields } from '@/components/QuoteItemsEditor'
import type { Product } from '@/app/api/lark/products/_mapper'
import { TaskChecklist } from '@/components/TaskChecklist'
import { PaymentSection } from '@/components/PaymentSection'

const formatPhone = (p: string) => p?.replace(/^84/, '0') ?? ''
const formatMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '—'
const formatDate = (ms: number | null) => {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function ProductThumb({ p }: { p: Product }) {
  const src = p.anh_sp || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${p.record_id}`
  const [show, setShow] = useState(true)
  if (!show) return (
    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
      <span className="text-lg">📦</span>
    </div>
  )
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 bg-gray-100" onError={() => setShow(false)} />
}

// ─── Pipeline Stage Selector ──────────────────────────────────────────────────

function PipelineSheet({
  current,
  onSelect,
  onClose,
}: {
  current: string
  onSelect: (s: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Cập nhật Pipeline</h2>
        </div>
        <div className="p-4 space-y-2 pb-8">
          {PIPELINE_STAGES.map((s, i) => {
            const pc = PIPELINE_COLORS[s]
            const active = current === s
            return (
              <button
                key={s}
                onClick={() => { onSelect(s); onClose() }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  active ? `${pc.bg} ${pc.text}` : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-sm font-medium w-5 text-center text-gray-400">{i + 1}</span>
                <span className="flex-1 text-sm font-medium">{s}</span>
                {active && <span className="text-xs">✓</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  if (!value || value === 'undefined' || value === 'null') return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-gray-700 flex-1 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [customer, setCustomer]           = useState<Customer | null>(null)
  const [loading, setLoading]             = useState(true)
  const [updating, setUpdating]           = useState(false)
  const [showPipeline, setShowPipeline]   = useState(false)
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [userRole, setUserRole]           = useState('')
  const [userFullName, setUserFullName]   = useState('')
  const [successMsg, setSuccessMsg]       = useState('')
  const [quotes, setQuotes]               = useState<Quote[]>([])
  const [quotesLoading, setQuotesLoading] = useState(false)

  // Quote form state — draftKey per customer, tự động lưu sessionStorage
  const qDraftKey = `quote_draft_${id}`
  const { items: qItems, total: qTotal, addItem: qAddItem, addBlank: qAddBlank, removeItem: qRemoveItem, changeItem: qChangeItem, clear: qClear } = useQuoteItems(qDraftKey)
  const [qChietKhau,       setQChietKhau]        = useState('0')
  const [qGhiChuKT,        setQGhiChuKT]         = useState('')
  const [qGhiChuTM,        setQGhiChuTM]         = useState('')
  const [qKenhTiepNhan,    setQKenhTiepNhan]      = useState('')
  const [qNgayGuiKH,       setQNgayGuiKH]         = useState('')
  const [qProducts,        setQProducts]          = useState<Product[]>([])
  const [qShowPicker,      setQShowPicker]        = useState(false)
  const [qSaving,          setQSaving]            = useState(false)
  const [qError,           setQError]             = useState('')

  const qCK      = Number(qChietKhau) || 0
  const qAfterCK = Math.round(qTotal * (1 - qCK / 100))
  const fmtM     = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '0₫'

  const loadQProducts = () => {
    if (qProducts.length > 0) { setQShowPicker(true); return }
    fetch('/api/lark/products').then(r => r.json()).then(d => { setQProducts(d.data ?? []); setQShowPicker(true) })
  }

  const submitQuote = async () => {
    if (!customer) return
    if (qItems.length === 0) { setQError('Vui lòng thêm ít nhất 1 sản phẩm'); return }
    setQSaving(true); setQError('')
    try {
      const { san_pham } = itemsToLarkFields(qItems)
      const res = await fetch('/api/lark/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          khach_hang:         customer.ho_ten,
          sdt:                customer.sdt,
          san_pham,
          tong_gia_tri:       qTotal,
          chiet_khau:         qCK,
          ghi_chu_ky_thuat:   qGhiChuKT,
          ghi_chu_thuong_mai: qGhiChuTM,
          kenh_tiep_nhan:     qKenhTiepNhan  || undefined,
          ngay_gui_kh:        qNgayGuiKH ? new Date(qNgayGuiKH).getTime() : undefined,
          customer_record_id: customer.record_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setQError(data.error || 'Lỗi tạo báo giá'); return }
      qClear()
      setShowQuoteForm(false)
      setSuccessMsg('Đã tạo báo giá')
      setTimeout(() => setSuccessMsg(''), 2500)
    } catch { setQError('Lỗi kết nối') }
    finally { setQSaving(false) }
  }

  // Load user profile (role) — dùng cho TaskChecklist + PaymentSection
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { setUserRole(d.role ?? ''); setUserFullName(d.full_name ?? '') })
      .catch(() => {})
  }, [])

  // Load lịch sử báo giá của KH
  useEffect(() => {
    setQuotesLoading(true)
    fetch(`/api/lark/quotes?customer_record_id=${id}`)
      .then(r => r.json())
      .then(d => setQuotes((d.data ?? []).sort((a: Quote, b: Quote) => b.phien_ban - a.phien_ban)))
      .catch(() => {})
      .finally(() => setQuotesLoading(false))
  }, [id])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/lark/customers/${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error()

        // Map raw Lark record fields to Customer shape
        const f = data.record.fields
        setCustomer({
          record_id:       id,
          ho_ten:          String(f['Họ tên KH'] ?? ''),
          sdt:             String(f['SĐT di động'] ?? ''),
          sdt_khac:        String(f['SĐT khác'] ?? ''),
          email:           String(f['Email'] ?? ''),
          ma_kh:           String(f['Mã KH (tự đặt)'] ?? ''),
          dia_chi_hd:      String(f['Địa chỉ ký HĐ'] ?? ''),
          dia_chi_ct:      String(f['Địa chỉ công trình'] ?? ''),
          pipeline:        String(f['Trạng thái pipeline'] ?? ''),
          nguoi_phu_trach: String(f['Người phụ trách'] ?? ''),
          nguon_kh:        String(f['Nguồn KH'] ?? ''),
          doi_tac_gt:      String(f['Đối tác giới thiệu'] ?? ''),
          loai_hinh_nha:   String(f['Loại hình nhà'] ?? ''),
          nguon_nuoc:      String(f['Nguồn nước'] ?? ''),
          san_pham_quan_tam: Array.isArray(f['Sản phẩm quan tâm'])
            ? f['Sản phẩm quan tâm'] as string[]
            : [],
          bao_gia:         Number(f['Giá trị báo giá (VNĐ)'] ?? 0),
          muc_uu_tien:     String(f['Mức ưu tiên'] ?? ''),
          ngay_lien_he_dau: f['Ngày liên hệ đầu'] ? Number(f['Ngày liên hệ đầu']) : null,
          ngay_cap_nhat:   f['Ngày cập nhật cuối'] ? Number(f['Ngày cập nhật cuối']) : null,
          noi_dung:        String(f['Nội dung trao đổi'] ?? ''),
          ly_do_tu_choi:   String(f['Lý do từ chối'] ?? ''),
          nhom_dv:         String(f['Nhóm dịch vụ'] ?? ''),
          tien_do_ct:      String(f['Tiến độ công trình'] ?? ''),
          khu_vuc:         String(f['Khu vực'] ?? ''),
        })
      } catch {
        // silently fail — user can go back
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const updatePipeline = async (newStage: string) => {
    if (!customer) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/lark/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline: newStage }),
      })
      if (!res.ok) throw new Error()
      setCustomer(prev => prev ? { ...prev, pipeline: newStage } : prev)
      setSuccessMsg('Đã cập nhật pipeline')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch {
      // silent fail
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="crm-spinner" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500 text-sm">Không tìm thấy khách hàng</p>
        <button onClick={() => router.back()} className="text-blue-600 text-sm font-semibold">← Quay lại</button>
      </div>
    )
  }

  const pipeline = customer.pipeline || 'Lead mới'
  const pc = PIPELINE_COLORS[pipeline] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
  const prc = PRIORITY_COLORS[customer.muc_uu_tien]
  const currentStageIdx = PIPELINE_STAGES.indexOf(pipeline as any)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800 truncate">{customer.ho_ten}</h1>
          <p className="text-xs text-gray-500">{customer.ma_kh || 'Chưa có mã KH'}</p>
        </div>
        {successMsg && (
          <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Pipeline card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">TRẠNG THÁI PIPELINE</p>

          {/* Progress bar */}
          {pipeline !== 'Lost' && (
            <div className="flex gap-1 mb-3">
              {PIPELINE_STAGES.filter(s => s !== 'Lost').map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= currentStageIdx ? pc.bg.replace('100', '500') : 'bg-gray-100'
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-xl ${pc.bg} ${pc.text}`}>
              {pipeline}
            </span>
            <button
              onClick={() => setShowPipeline(true)}
              disabled={updating}
              className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-xl"
            >
              {updating ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </div>
        </div>

        {/* Task Checklist */}
        {userRole && (
          <TaskChecklist
            customerId={id}
            stage={pipeline}
            userRole={userRole}
          />
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          <a
            href={`tel:${customer.sdt}`}
            className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col items-center gap-1.5"
          >
            <span className="text-xl">📞</span>
            <span className="text-xs text-gray-600 font-medium">Gọi điện</span>
          </a>
          <a
            href={`https://zalo.me/${customer.sdt.replace(/^0/, '84')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col items-center gap-1.5"
          >
            <span className="text-xl">💬</span>
            <span className="text-xs text-gray-600 font-medium">Zalo</span>
          </a>
          {customer.email ? (
            <a
              href={`mailto:${customer.email}`}
              className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col items-center gap-1.5"
            >
              <span className="text-xl">✉️</span>
              <span className="text-xs text-gray-600 font-medium">Email</span>
            </a>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 flex flex-col items-center gap-1.5 opacity-40">
              <span className="text-xl">✉️</span>
              <span className="text-xs text-gray-500 font-medium">Email</span>
            </div>
          )}
          <button
            onClick={() => setShowQuoteForm(true)}
            className="bg-blue-50 rounded-2xl p-3 border border-blue-100 flex flex-col items-center gap-1.5 active:bg-blue-100"
          >
            <span className="text-xl">📋</span>
            <span className="text-xs text-blue-600 font-medium">Báo giá</span>
          </button>
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">THÔNG TIN LIÊN HỆ</p>
          <InfoRow label="Họ tên" value={customer.ho_ten} />
          <InfoRow label="SĐT di động" value={formatPhone(customer.sdt)} />
          <InfoRow label="SĐT khác" value={formatPhone(customer.sdt_khac)} />
          <InfoRow label="Email" value={customer.email} />
          <InfoRow label="Địa chỉ ký HĐ" value={customer.dia_chi_hd} />
          <InfoRow label="Địa chỉ công trình" value={customer.dia_chi_ct} />
        </div>

        {/* Sales info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">THÔNG TIN KINH DOANH</p>
          <InfoRow label="Người phụ trách" value={customer.nguoi_phu_trach} />
          <InfoRow label="Nguồn KH" value={customer.nguon_kh} />
          <InfoRow label="Đối tác giới thiệu" value={customer.doi_tac_gt} />
          <InfoRow label="Loại hình nhà" value={customer.loai_hinh_nha} />
          <InfoRow label="Nguồn nước" value={customer.nguon_nuoc} />
          <InfoRow label="Nhóm dịch vụ" value={customer.nhom_dv} />
          <InfoRow label="Tiến độ công trình" value={customer.tien_do_ct} />
          {customer.san_pham_quan_tam?.length > 0 && (
            <InfoRow label="Sản phẩm quan tâm" value={customer.san_pham_quan_tam.join(', ')} />
          )}
          {customer.bao_gia > 0 && (
            <InfoRow label="Giá trị báo giá" value={formatMoney(customer.bao_gia)} />
          )}
          {prc && customer.muc_uu_tien && (
            <div className="flex items-start gap-3 py-2.5">
              <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">Mức ưu tiên</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prc.bg} ${prc.text}`}>
                {customer.muc_uu_tien}
              </span>
            </div>
          )}
          <InfoRow label="Ngày liên hệ đầu" value={formatDate(customer.ngay_lien_he_dau)} />
        </div>

        {/* Notes */}
        {customer.noi_dung && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 mb-2">NỘI DUNG TRAO ĐỔI</p>
            <p className="text-sm text-gray-700 leading-relaxed">{customer.noi_dung}</p>
          </div>
        )}

        {/* Lịch sử Báo giá */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400">LỊCH SỬ BÁO GIÁ</p>
            <button onClick={() => setShowQuoteForm(true)}
              className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-xl">
              + Tạo mới
            </button>
          </div>

          {quotesLoading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-gray-400 text-xs"><span className="crm-spinner" style={{width:16,height:16,borderWidth:2}} /><span>Đang tải...</span></div>
          ) : quotes.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4 pb-5">Chưa có báo giá nào</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {quotes.map(q => {
                const now = Date.now()
                const expired = q.ngay_het_han ? now > q.ngay_het_han : false
                const status  = (expired && !['Chấp nhận','Từ chối'].includes(q.trang_thai)) ? 'Hết hạn' : q.trang_thai
                const sc      = QUOTE_STATUS_COLORS[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
                return (
                  <button key={q.record_id}
                    onClick={() => router.push(`/dashboard/orders/quote/${q.record_id}`)}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 active:bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-blue-600">v{q.phien_ban}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{q.ma_bao_gia}</p>
                      <p className="text-xs text-gray-500">
                        {(q.gia_tri_sau_ck || q.tong_gia_tri).toLocaleString('vi-VN')}₫
                        {q.ngay_lap ? ` · ${new Date(q.ngay_lap).toLocaleDateString('vi-VN')}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${sc.bg} ${sc.text}`}>
                      {status}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Thanh toán 3 đợt — chỉ hiện từ giai đoạn Chốt HĐ trở đi */}
        {currentStageIdx >= PIPELINE_STAGES.indexOf('Chốt HĐ') && pipeline !== 'Lost' && userRole && (
          <PaymentSection
            customerId={id}
            customerName={customer.ho_ten}
            nguoiPhuTrach={customer.nguoi_phu_trach}
            userRole={userRole}
          />
        )}

        {customer.ly_do_tu_choi && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <p className="text-xs font-semibold text-red-400 mb-2">LÝ DO TỪ CHỐI</p>
            <p className="text-sm text-red-700 leading-relaxed">{customer.ly_do_tu_choi}</p>
          </div>
        )}
      </div>

      {showPipeline && (
        <PipelineSheet
          current={pipeline}
          onSelect={updatePipeline}
          onClose={() => setShowPipeline(false)}
        />
      )}

      {showQuoteForm && (
        <>
          {/* Product picker */}
          {qShowPicker && (
            <div className="fixed inset-0 z-[60] flex flex-col bg-white">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <button onClick={() => setQShowPicker(false)} className="text-gray-500 p-2.5 -ml-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-base font-bold text-gray-800">Chọn sản phẩm</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {qProducts.map(p => (
                  <button key={p.record_id}
                    onClick={() => { qAddItem({ ten_sp: p.ten_sp, don_gia: p.gia_chiet_khau || p.gia_niem_yet || 0 }); setQShowPicker(false) }}
                    className="w-full px-4 py-3.5 border-b border-gray-50 text-left flex items-center gap-3 active:bg-blue-50">
                    <ProductThumb p={p} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.ten_sp}</p>
                      <p className="text-xs text-gray-500">{p.ma_sp}</p>
                    </div>
                    <span className="text-sm font-bold text-blue-600 flex-shrink-0">
                      {(p.gia_chiet_khau > 0 ? p.gia_chiet_khau : p.gia_niem_yet).toLocaleString('vi-VN')}₫
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
            onClick={e => e.target === e.currentTarget && setShowQuoteForm(false)}>
            <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col">
              <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-bold text-gray-800">Tạo báo giá</h2>
                  <p className="text-xs text-gray-500">{customer.ho_ten}</p>
                </div>
                <button onClick={() => setShowQuoteForm(false)} className="text-gray-400 p-1">✕</button>
              </div>

              {qError && (
                <div className="mx-5 mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium flex-shrink-0">{qError}</div>
              )}

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500">SẢN PHẨM ĐỀ XUẤT</label>
                    {qItems.length > 0 && <button onClick={qClear} className="text-xs text-red-400 font-medium">Xoá tất cả</button>}
                  </div>

                  <div className="space-y-2">
                    {qItems.map(item => (
                      <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex gap-2">
                          <input value={item.ten_sp} onChange={e => qChangeItem(item.id, 'ten_sp', e.target.value)}
                            placeholder="Tên sản phẩm"
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          <button onClick={() => qRemoveItem(item.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
                            <button onClick={() => qChangeItem(item.id, 'so_luong', Math.max(1, item.so_luong - 1))} className="w-5 h-5 flex items-center justify-center text-gray-500">−</button>
                            <span className="text-sm font-semibold text-gray-700 w-5 text-center">{item.so_luong}</span>
                            <button onClick={() => qChangeItem(item.id, 'so_luong', item.so_luong + 1)} className="w-5 h-5 flex items-center justify-center text-gray-500">+</button>
                          </div>
                          <span className="text-gray-300 text-sm">×</span>
                          <input type="number" value={item.don_gia || ''}
                            onChange={e => qChangeItem(item.id, 'don_gia', Number(e.target.value) || 0)}
                            placeholder="Đơn giá"
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          <span className="text-xs font-semibold text-blue-600 flex-shrink-0 min-w-[72px] text-right">
                            {fmtM(item.so_luong * item.don_gia)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button onClick={loadQProducts} className="flex-1 border-2 border-dashed border-blue-200 rounded-xl py-2.5 text-xs text-blue-600 font-semibold">+ Chọn từ danh mục</button>
                    <button onClick={qAddBlank} className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-xs text-gray-500 font-semibold">+ Nhập thủ công</button>
                  </div>

                  {qItems.length > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                      <span className="text-xs text-gray-400">{qItems.length} sản phẩm</span>
                      <span className="text-sm font-bold text-gray-800">{fmtM(qTotal)}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-1 block">CHIẾT KHẤU TỔNG (%)</label>
                  <input type="number" value={qChietKhau} onChange={e => setQChietKhau(e.target.value)} placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {qTotal > 0 && qCK > 0 && (
                  <div className="bg-green-50 rounded-xl px-4 py-3 flex justify-between items-center">
                    <span className="text-xs text-gray-500">Giá sau chiết khấu</span>
                    <span className="text-sm font-bold text-green-600">{fmtM(qAfterCK)}</span>
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-1 block">NGUỒN KH</label>
                  <select value={qKenhTiepNhan} onChange={e => setQKenhTiepNhan(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['', ...NGUON_KH_OPTIONS].map(o => (
                      <option key={o} value={o}>{o || '— Chọn —'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-1 block">NGÀY GỬI KH</label>
                  <input type="date" value={qNgayGuiKH} onChange={e => setQNgayGuiKH(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-1 block">GHI CHÚ KỸ THUẬT</label>
                  <textarea rows={2} value={qGhiChuKT} onChange={e => setQGhiChuKT(e.target.value)} placeholder="Thông số, yêu cầu lắp đặt..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-1 block">GHI CHÚ THƯƠNG MẠI</label>
                  <textarea rows={2} value={qGhiChuTM} onChange={e => setQGhiChuTM(e.target.value)} placeholder="Điều kiện thanh toán, giao hàng..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 sheet-safe">
                <button onClick={() => setShowQuoteForm(false)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">Huỷ</button>
                <button onClick={submitQuote} disabled={qSaving} className="flex-1 bg-blue-600 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl text-sm">
                  {qSaving ? 'Đang lưu...' : 'Tạo báo giá'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
