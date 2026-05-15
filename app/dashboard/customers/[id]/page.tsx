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
import { ACTIVITY_ICONS, ACTIVITY_LABELS, type ActivityRecord } from '@/lib/activity'
import { computeHealthScore } from '@/lib/health'

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

// ─── Lost Reason Sheet ───────────────────────────────────────────────────────

const LY_DO_LOST_OPTIONS = [
  'Giá cao hơn đối thủ',
  'Chọn sản phẩm / thương hiệu khác',
  'Không đủ ngân sách',
  'Thay đổi nhu cầu / hoãn kế hoạch',
  'Không liên hệ được',
  'Khác',
]

function LostReasonSheet({
  onConfirm,
  onClose,
}: {
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState('')
  const [other, setOther]       = useState('')

  const reason = selected === 'Khác' ? other.trim() : selected

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
          <h2 className="text-base font-bold text-gray-800">Lý do không chốt được</h2>
          <p className="text-xs text-gray-400 mt-0.5">Bắt buộc khi chuyển sang Lost</p>
        </div>
        <div className="p-4 space-y-2">
          {LY_DO_LOST_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setSelected(opt)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${
                selected === opt
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'text-gray-700 border border-transparent hover:bg-gray-50'
              }`}
            >
              <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selected === opt ? 'border-red-500 bg-red-500' : 'border-gray-300'}`} />
              {opt}
            </button>
          ))}
          {selected === 'Khác' && (
            <textarea
              value={other}
              onChange={e => setOther(e.target.value)}
              placeholder="Nhập lý do cụ thể..."
              rows={2}
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400 resize-none"
            />
          )}
        </div>
        <div className="px-4 pb-8 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600">
            Huỷ
          </button>
          <button
            onClick={() => reason && onConfirm(reason)}
            disabled={!reason}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-40"
          >
            Xác nhận Lost
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Contact Log Sheet ────────────────────────────────────────────────────────

const LOG_TYPES = [
  { value: 'Gọi điện', icon: '📞' },
  { value: 'Gặp mặt',  icon: '🤝' },
  { value: 'Zalo',     icon: '💬' },
  { value: 'Email',    icon: '✉️' },
] as const

const LOG_RESULTS = ['Liên hệ được', 'Không bắt máy', 'Để lại lời nhắn', 'Hẹn lại'] as const

function ContactLogSheet({
  customerPhone,
  onSave,
  onClose,
}: {
  customerPhone: string
  onSave: (log: { type: string; result: string; note: string }) => void
  onClose: () => void
}) {
  const [logType,   setLogType]   = useState<string>('Gọi điện')
  const [logResult, setLogResult] = useState<string>('')
  const [note,      setNote]      = useState('')

  const canSave = logResult !== ''

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-800">Ghi nhận liên hệ</h2>
          <p className="text-xs text-gray-400 mt-0.5">{formatPhone(customerPhone)}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Loại liên hệ */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">HÌNH THỨC</p>
            <div className="grid grid-cols-4 gap-2">
              {LOG_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setLogType(t.value)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    logType === t.value
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="text-lg">{t.icon}</span>
                  {t.value}
                </button>
              ))}
            </div>
          </div>
          {/* Kết quả */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">KẾT QUẢ *</p>
            <div className="space-y-1.5">
              {LOG_RESULTS.map(r => (
                <button key={r} type="button"
                  onClick={() => setLogResult(r)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm font-medium border transition-all ${
                    logResult === r
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'border-gray-100 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${logResult === r ? 'border-green-500 bg-green-500' : 'border-gray-300'}`} />
                  {r}
                </button>
              ))}
            </div>
          </div>
          {/* Ghi chú */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">GHI CHÚ</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Nội dung trao đổi, hẹn lịch, yêu cầu KH..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>
          {/* Gọi nhanh */}
          {logType === 'Gọi điện' && (
            <a href={`tel:${customerPhone}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-green-200 text-green-700 text-sm font-medium bg-green-50">
              <span>📞</span> Gọi ngay {formatPhone(customerPhone)}
            </a>
          )}
        </div>
        <div className="px-4 pb-8 pt-2 flex gap-2 border-t border-gray-50 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600">Huỷ</button>
          <button
            onClick={() => canSave && onSave({ type: logType, result: logResult, note: note.trim() })}
            disabled={!canSave}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            Lưu ghi nhận
          </button>
        </div>
      </div>
    </div>
  )
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
  const [editingInfo, setEditingInfo]     = useState(false)
  const [infoForm, setInfoForm]           = useState({
    ho_ten: '', sdt: '', dia_chi_hd: '', dia_chi_ct: '', noi_dung: '',
    khu_vuc: '', loai_kh: '', nhom_dv: '', nguon_kh: '', muc_uu_tien: '',
  })
  const [infoSaving, setInfoSaving]       = useState(false)
  const [infoError, setInfoError]         = useState('')
  const [pipelineWarnings, setPipelineWarnings] = useState<string[]>([])
  const [showLostSheet, setShowLostSheet]         = useState(false)
  const [showContactLog, setShowContactLog]       = useState(false)
  const [logSaving, setLogSaving]                 = useState(false)
  const [activities, setActivities]               = useState<ActivityRecord[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activeTab, setActiveTab]                 = useState<'overview'|'quotes'|'payment'|'aftercare'|'history'>('overview')
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
          items: qItems.map(i => ({ ten_sp: i.ten_sp, don_gia: i.don_gia, so_luong: i.so_luong, product_id: i.product_id ?? null })),
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

  // Load activity timeline
  useEffect(() => {
    setActivitiesLoading(true)
    fetch(`/api/lark/customers/${id}/activities`)
      .then(r => r.json())
      .then(d => setActivities(d.data ?? []))
      .catch(() => {})
      .finally(() => setActivitiesLoading(false))
  }, [id])

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
        // API now returns flat { customer } — no field mapping needed
        setCustomer(data.customer)
        const c = data.customer
        setInfoForm({
          ho_ten:     c.ho_ten     ?? '',
          sdt:        c.sdt        ?? '',
          dia_chi_hd: c.dia_chi_hd ?? '',
          dia_chi_ct: c.dia_chi_ct ?? '',
          noi_dung:   c.noi_dung   ?? '',
          khu_vuc:    c.khu_vuc    ?? '',
          loai_kh:    c.loai_kh    ?? '',
          nhom_dv:    c.nhom_dv    ?? '',
          nguon_kh:   c.nguon_kh   ?? '',
          muc_uu_tien: c.muc_uu_tien ?? '',
        })
      } catch {
        // silently fail — user can go back
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handlePipelineSelect = (newStage: string) => {
    if (newStage === 'Lost') {
      setShowLostSheet(true)
    } else {
      void updatePipeline(newStage)
    }
  }

  const updatePipeline = async (newStage: string, lyDoTuChoi?: string) => {
    if (!customer) return
    setUpdating(true)
    try {
      const body: Record<string, unknown> = { pipeline: newStage }
      if (lyDoTuChoi) body.ly_do_tu_choi = lyDoTuChoi
      const res = await fetch(`/api/lark/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCustomer(prev => prev ? {
        ...prev,
        pipeline: newStage,
        ...(lyDoTuChoi ? { ly_do_tu_choi: lyDoTuChoi } : {}),
      } : prev)
      if (data.warnings?.length) {
        setPipelineWarnings(data.warnings)
      } else {
        setSuccessMsg('Đã cập nhật pipeline')
        setTimeout(() => setSuccessMsg(''), 2000)
      }
    } catch {
      setSuccessMsg('Lỗi cập nhật pipeline')
      setTimeout(() => setSuccessMsg(''), 2000)
    } finally {
      setUpdating(false)
    }
  }

  const saveInfoForm = async () => {
    if (!infoForm.ho_ten.trim() || !infoForm.sdt.trim()) {
      setInfoError('Họ tên và SĐT không được để trống')
      return
    }
    setInfoSaving(true); setInfoError('')
    try {
      const res = await fetch(`/api/lark/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ho_ten:     infoForm.ho_ten.trim(),
          sdt:        infoForm.sdt.trim(),
          dia_chi_hd: infoForm.dia_chi_hd || null,
          dia_chi_ct: infoForm.dia_chi_ct || null,
          noi_dung:   infoForm.noi_dung   || null,
          khu_vuc:    infoForm.khu_vuc    || null,
          loai_kh:    infoForm.loai_kh    || null,
          nhom_dv:    infoForm.nhom_dv    || null,
          nguon_kh:   infoForm.nguon_kh   || null,
          muc_uu_tien: infoForm.muc_uu_tien || null,
        }),
      })
      if (!res.ok) { setInfoError('Lỗi lưu thông tin'); return }
      setCustomer(prev => prev ? {
        ...prev,
        ho_ten:     infoForm.ho_ten,
        sdt:        infoForm.sdt,
        dia_chi_hd: infoForm.dia_chi_hd,
        dia_chi_ct: infoForm.dia_chi_ct,
        noi_dung:   infoForm.noi_dung,
        khu_vuc:    infoForm.khu_vuc,
        loai_kh:    infoForm.loai_kh,
        nhom_dv:    infoForm.nhom_dv,
        nguon_kh:   infoForm.nguon_kh,
        muc_uu_tien: infoForm.muc_uu_tien,
      } : prev)
      setEditingInfo(false)
      setSuccessMsg('Đã cập nhật thông tin')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch { setInfoError('Lỗi kết nối') }
    finally { setInfoSaving(false) }
  }

  const handleSaveLog = async ({ type, result, note }: { type: string; result: string; note: string }) => {
    if (!customer) return
    setLogSaving(true)
    const now = new Date()
    const dateStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
    const entry = `[${dateStr} – ${userFullName || 'NV'}] ${type}: ${result}${note ? '. ' + note : ''}`
    const newNoidung = customer.noi_dung
      ? `${entry}\n---\n${customer.noi_dung}`
      : entry
    try {
      const res = await fetch(`/api/lark/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noi_dung: newNoidung }),
      })
      if (!res.ok) throw new Error()
      setCustomer(prev => prev ? { ...prev, noi_dung: newNoidung } : prev)
      setInfoForm(f => ({ ...f, noi_dung: newNoidung }))
      // Also POST to activities API (fire-and-forget, table may not exist yet)
      void fetch(`/api/lark/customers/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'contact_log', content: entry, meta: { result: '', note } }),
      }).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.ok) {
          // Refresh activities
          fetch(`/api/lark/customers/${id}/activities`).then(r => r.json()).then(d2 => setActivities(d2.data ?? []))
        }
      })
      setShowContactLog(false)
      setSuccessMsg('Đã ghi nhận liên hệ')
      setTimeout(() => setSuccessMsg(''), 2500)
    } catch {
      // silent fail — log still useful
    } finally {
      setLogSaving(false)
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
  const health = computeHealthScore({ ngay_cap_nhat: customer.ngay_cap_nhat ?? null, pipeline })

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
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-500">{customer.ma_kh || 'Chưa có mã KH'}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${health.bgColor} ${health.color}`}>
              {health.label}
            </span>
          </div>
        </div>
        {successMsg && (
          <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-100 sticky top-[57px] z-10">
        <div className="flex overflow-x-auto scrollbar-none px-2">
          {([
            { key: 'overview',  label: 'Tổng quan',  icon: '📋' },
            { key: 'quotes',    label: 'Báo giá',    icon: '💼' },
            { key: 'payment',   label: 'Thanh toán', icon: '💰' },
            { key: 'aftercare', label: 'Dịch vụ',    icon: '🔧' },
            { key: 'history',   label: 'Lịch sử',    icon: '🕐' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                activeTab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── Tab: Tổng quan ───────────────────────────────────────────────── */}
        {activeTab === 'overview' && <>

        {/* Pipeline warnings */}
        {pipelineWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-amber-700 mb-2">⚠️ Đã cập nhật pipeline — Lưu ý:</p>
            {pipelineWarnings.map((w, i) => (
              <p key={i} className="text-sm text-amber-800 leading-relaxed">{w}</p>
            ))}
            <button onClick={() => setPipelineWarnings([])}
              className="text-xs text-gray-400 mt-2">Đóng</button>
          </div>
        )}

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
              className="text-xs text-blue-600 font-semibold bg-blue-50 px-4 py-2 rounded-xl"
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
          <button
            onClick={() => setShowContactLog(true)}
            className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col items-center gap-1.5 active:bg-gray-50"
          >
            <span className="text-xl">📞</span>
            <span className="text-xs text-gray-600 font-medium">Gọi điện</span>
          </button>
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
          {['admin', 'ceo', 'director', 'sales'].includes(userRole) && (
            <button
              onClick={() => setShowQuoteForm(true)}
              className="bg-blue-50 rounded-2xl p-3 border border-blue-100 flex flex-col items-center gap-1.5 active:bg-blue-100"
            >
              <span className="text-xl">📋</span>
              <span className="text-xs text-blue-600 font-medium">Báo giá</span>
            </button>
          )}
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400">THÔNG TIN LIÊN HỆ</p>
            {['admin', 'ceo', 'director', 'sales'].includes(userRole) && !editingInfo && (
              <button onClick={() => setEditingInfo(true)}
                className="text-xs text-blue-600 font-medium">Sửa</button>
            )}
          </div>

          {editingInfo ? (
            <div className="space-y-3">
              {[
                { label: 'Họ tên *', key: 'ho_ten',     placeholder: 'Nguyễn Văn A' },
                { label: 'SĐT *',    key: 'sdt',        placeholder: '0901234567' },
                { label: 'Địa chỉ ký HĐ', key: 'dia_chi_hd', placeholder: '' },
                { label: 'Địa chỉ CT',    key: 'dia_chi_ct', placeholder: '' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <input
                    value={infoForm[key as keyof typeof infoForm]}
                    onChange={e => setInfoForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              ))}
              <div>
                <p className="text-xs text-gray-400 mb-1">Nội dung trao đổi</p>
                <textarea
                  value={infoForm.noi_dung}
                  onChange={e => setInfoForm(f => ({ ...f, noi_dung: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>
              {/* Loại KH */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Loại KH</p>
                <div className="flex gap-2">
                  {(['B2C', 'Đại lý', 'Dự án'] as const).map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setInfoForm(f => ({ ...f, loai_kh: opt }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                        infoForm.loai_kh === opt
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-600 hover:border-blue-300'
                      }`}
                    >{opt}</button>
                  ))}
                </div>
              </div>
              {/* Khu vực */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Khu vực</p>
                <div className="flex gap-2">
                  {(['Miền Nam', 'Miền Bắc', 'Miền Trung'] as const).map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setInfoForm(f => ({ ...f, khu_vuc: f.khu_vuc === opt ? '' : opt }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                        infoForm.khu_vuc === opt
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}
                    >{opt}</button>
                  ))}
                </div>
              </div>
              {/* Nguồn KH */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Nguồn KH</p>
                <select
                  value={infoForm.nguon_kh}
                  onChange={e => setInfoForm(f => ({ ...f, nguon_kh: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
                >
                  <option value="">— Chọn nguồn —</option>
                  {NGUON_KH_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              {/* Nhóm DV */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Nhóm dịch vụ</p>
                <select
                  value={infoForm.nhom_dv}
                  onChange={e => setInfoForm(f => ({ ...f, nhom_dv: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
                >
                  <option value="">— Chọn nhóm DV —</option>
                  {['BL1 — Lắp đặt trọn gói','BL1 + BL3 — Lắp đặt + Định kỳ','BL2 — Thương mại','BL3 — Dịch vụ định kỳ'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              {/* Mức ưu tiên */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Mức ưu tiên</p>
                <div className="flex gap-2">
                  {(['Cao', 'Trung bình', 'Thấp'] as const).map((opt, i) => (
                    <button key={opt} type="button"
                      onClick={() => setInfoForm(f => ({ ...f, muc_uu_tien: f.muc_uu_tien === opt ? '' : opt }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                        infoForm.muc_uu_tien === opt
                          ? i === 0 ? 'bg-red-500 text-white border-red-500'
                            : i === 1 ? 'bg-yellow-400 text-white border-yellow-400'
                            : 'bg-gray-400 text-white border-gray-400'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >{opt}</button>
                  ))}
                </div>
              </div>
              {infoError && <p className="text-xs text-red-500">{infoError}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setEditingInfo(false); setInfoError('') }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Huỷ</button>
                <button onClick={saveInfoForm} disabled={infoSaving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                  {infoSaving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <InfoRow label="Họ tên" value={customer.ho_ten} />
              <InfoRow label="SĐT di động" value={formatPhone(customer.sdt)} />
              <InfoRow label="SĐT khác" value={formatPhone(customer.sdt_khac)} />
              <InfoRow label="Email" value={customer.email} />
              <InfoRow label="Địa chỉ ký HĐ" value={customer.dia_chi_hd} />
              <InfoRow label="Địa chỉ công trình" value={customer.dia_chi_ct} />
            </>
          )}
        </div>

        {/* Sales info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">THÔNG TIN KINH DOANH</p>
          <InfoRow label="Người phụ trách" value={customer.nguoi_phu_trach} />
          {customer.loai_kh && (
            <div className="flex items-start gap-3 py-2.5">
              <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">Loại KH</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                customer.loai_kh === 'B2C'    ? 'bg-blue-50 text-blue-700' :
                customer.loai_kh === 'Đại lý' ? 'bg-green-50 text-green-700' :
                customer.loai_kh === 'Dự án'  ? 'bg-purple-50 text-purple-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {customer.loai_kh === 'B2C' ? '🏠' : customer.loai_kh === 'Đại lý' ? '🏪' : '🏗️'} {customer.loai_kh}
              </span>
            </div>
          )}
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

        {/* Notes — luôn hiển thị nếu có nội dung hoặc đang edit */}
        {(customer.noi_dung || editingInfo) ? (
          !editingInfo && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 mb-2">NỘI DUNG TRAO ĐỔI</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{customer.noi_dung}</p>
            </div>
          )
        ) : null}

        </> /* end tab: overview */}

        {/* ── Tab: Báo giá & HĐ ───────────────────────────────────────────── */}
        {activeTab === 'quotes' && <>

        {/* Lịch sử Báo giá */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400">LỊCH SỬ BÁO GIÁ</p>
            {['admin', 'ceo', 'director', 'sales'].includes(userRole) && (
              <button onClick={() => setShowQuoteForm(true)}
                className="text-xs text-blue-600 font-semibold bg-blue-50 px-4 py-2 rounded-xl">
                + Tạo mới
              </button>
            )}
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

        </> /* end tab: quotes */}

        {/* ── Tab: Thanh toán ──────────────────────────────────────────────── */}
        {activeTab === 'payment' && <>

        {currentStageIdx >= PIPELINE_STAGES.indexOf('Chốt HĐ') && pipeline !== 'Lost' && userRole ? (
          <PaymentSection
            customerId={id}
            customerName={customer.ho_ten}
            nguoiPhuTrach={customer.nguoi_phu_trach}
            userRole={userRole}
          />
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl mb-2">💰</p>
            <p className="text-sm text-gray-500">Thanh toán sẽ hiện sau khi KH đạt giai đoạn Chốt HĐ</p>
          </div>
        )}

        </> /* end tab: payment */}

        {/* ── Tab: Dịch vụ (Bảo trì / Bảo hành) ─────────────────────────── */}
        {activeTab === 'aftercare' && <>

        <div className="space-y-3">
          <button
            onClick={() => router.push(`/dashboard/maintenance?customer_id=${id}`)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 active:bg-gray-50 text-left"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🔧</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">Lịch bảo trì</p>
              <p className="text-xs text-gray-400 mt-0.5">Xem và quản lý lịch bảo trì định kỳ</p>
            </div>
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => router.push(`/dashboard/warranty?customer_id=${id}`)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 active:bg-gray-50 text-left"
          >
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🛡️</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">Phiếu bảo hành</p>
              <p className="text-xs text-gray-400 mt-0.5">Xem ticket bảo hành và yêu cầu hỗ trợ</p>
            </div>
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        </> /* end tab: aftercare */}

        {/* ── Tab: Lịch sử ─────────────────────────────────────────────────── */}
        {activeTab === 'history' && <>

        {/* Activity Timeline */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <p className="text-xs font-semibold text-gray-400">LỊCH SỬ HOẠT ĐỘNG</p>
          </div>
          {activitiesLoading ? (
            <div className="flex items-center justify-center gap-2 py-5 text-gray-400 text-xs">
              <span className="crm-spinner" style={{width:16,height:16,borderWidth:2}} /><span>Đang tải...</span>
            </div>
          ) : activities.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-5 pb-6">Chưa có hoạt động nào</p>
          ) : (
            <div className="px-4 pb-4">
              {(() => {
                // Group by date
                const groups: Record<string, ActivityRecord[]> = {}
                activities.forEach(a => {
                  const day = new Date(a.created_at).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })
                  ;(groups[day] ??= []).push(a)
                })
                return Object.entries(groups).map(([day, acts]) => (
                  <div key={day} className="mb-4 last:mb-0">
                    <p className="text-xs text-gray-300 font-medium mb-2">{day}</p>
                    <div className="space-y-2 pl-2 border-l-2 border-gray-100">
                      {acts.map(a => (
                        <div key={a.id} className="relative pl-4">
                          <span className="absolute -left-[9px] top-1 w-4 h-4 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center text-[9px]">
                            {ACTIVITY_ICONS[a.type as keyof typeof ACTIVITY_ICONS] ?? '•'}
                          </span>
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-gray-700">{a.user_name}</span>
                            {' · '}
                            {ACTIVITY_LABELS[a.type as keyof typeof ACTIVITY_LABELS] ?? a.type}
                            {' · '}
                            {new Date(a.created_at).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })}
                          </p>
                          {a.content && (
                            <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{a.content}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>

        {/* Lost card — hiện ở tab Lịch sử */}
        {pipeline === 'Lost' && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-xs font-semibold text-red-400">LÝ DO TỪ CHỐI</p>
              {['admin', 'ceo', 'director'].includes(userRole) && (
                <button
                  onClick={() => void updatePipeline('Tiềm năng')}
                  disabled={updating}
                  className="text-xs text-blue-600 font-semibold bg-white border border-blue-200 px-3 py-1 rounded-lg shrink-0 disabled:opacity-50"
                >
                  🔄 Mở lại
                </button>
              )}
            </div>
            {customer.ly_do_tu_choi ? (
              <p className="text-sm text-red-700 leading-relaxed">{customer.ly_do_tu_choi}</p>
            ) : (
              <p className="text-xs text-red-400 italic">Chưa ghi lý do</p>
            )}
          </div>
        )}

        </> /* end tab: history */}
      </div>

      {showPipeline && (
        <PipelineSheet
          current={pipeline}
          onSelect={stage => { setShowPipeline(false); handlePipelineSelect(stage) }}
          onClose={() => setShowPipeline(false)}
        />
      )}

      {showLostSheet && (
        <LostReasonSheet
          onConfirm={reason => { setShowLostSheet(false); void updatePipeline('Lost', reason) }}
          onClose={() => setShowLostSheet(false)}
        />
      )}

      {showContactLog && customer && (
        <ContactLogSheet
          customerPhone={customer.sdt}
          onSave={handleSaveLog}
          onClose={() => setShowContactLog(false)}
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
                    onClick={() => { qAddItem({ ten_sp: p.ten_sp, don_gia: p.gia_chiet_khau || p.gia_niem_yet || 0, product_id: parseInt(p.record_id) || null }); setQShowPicker(false) }}
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
                          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
                            <button onClick={() => qChangeItem(item.id, 'so_luong', Math.max(1, item.so_luong - 1))} className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-md hover:bg-gray-100">−</button>
                            <span className="text-sm font-semibold text-gray-700 w-6 text-center">{item.so_luong}</span>
                            <button onClick={() => qChangeItem(item.id, 'so_luong', item.so_luong + 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-md hover:bg-gray-100">+</button>
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
