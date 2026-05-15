'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { QUOTE_STATUS_COLORS, NGUON_KH_OPTIONS } from '@/lib/lark/tables'
import type { Quote, QuoteType } from '@/app/api/lark/quotes/_mappers'
import { STATUSES_BY_TYPE } from '@/app/api/lark/quotes/_mappers'
import type { Customer } from '@/app/api/lark/customers/route'
import type { Product } from '@/app/api/lark/products/_mapper'
import { useQuoteItems, itemsToLarkFields } from '@/components/QuoteItemsEditor'
import { useQuoteData, isDueForFollowUp } from '@/lib/hooks/useQuoteData'
import { QuoteFollowUpBanner } from '@/components/QuoteFollowUpBanner'
import { usePullToRefresh, PullIndicator } from '@/components/PullToRefresh'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '—'
const fmtDate  = (ms: number | null) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS_COMMERCIAL: Record<string, { bg: string; text: string }> = {
  'Báo giá':  { bg: 'bg-blue-50',   text: 'text-blue-600'  },
  'Đã gửi':  { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  'Xác nhận': { bg: 'bg-green-50',  text: 'text-green-600'  },
  'Từ chối':  { bg: 'bg-red-50',    text: 'text-red-600'    },
}

const STATUS_COLORS_PROJECT: Record<string, { bg: string; text: string }> = {
  'Chuẩn bị HS':  { bg: 'bg-gray-100',   text: 'text-gray-600'   },
  'Đã nộp thầu':  { bg: 'bg-blue-50',    text: 'text-blue-600'   },
  'Chờ kết quả':  { bg: 'bg-amber-50',   text: 'text-amber-600'  },
  'Thắng thầu':   { bg: 'bg-green-50',   text: 'text-green-700'  },
  'Thua thầu':    { bg: 'bg-red-50',     text: 'text-red-600'    },
}

function StatusBadge({ label, type }: { label: string; type: QuoteType }) {
  const colors =
    type === 'commercial' ? STATUS_COLORS_COMMERCIAL :
    type === 'project'    ? STATUS_COLORS_PROJECT :
    QUOTE_STATUS_COLORS
  const c = colors[label] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${c.bg} ${c.text}`}>
      {label}
    </span>
  )
}

// ─── Quote Cards ──────────────────────────────────────────────────────────────

function B2CCard({ q, onClick }: { q: Quote; onClick: () => void }) {
  const now         = Date.now()
  const isExpired   = q.ngay_het_han && now > q.ngay_het_han
    && !['Chấp nhận', 'Từ chối'].includes(q.trang_thai)
  const displayStatus = isExpired ? 'Hết hạn' : q.trang_thai
  const isPending   = q.trang_thai === 'Chờ duyệt'
  const daysLeft    = q.ngay_het_han ? Math.ceil((q.ngay_het_han - now) / 86400000) : null
  const isSoonExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 3
    && !['Chấp nhận', 'Từ chối'].includes(q.trang_thai)

  return (
    <button onClick={onClick}
      className={`w-full bg-white rounded-2xl shadow-sm border p-4 text-left active:scale-[0.98] transition-transform ${
        isPending ? 'border-amber-300 bg-amber-50' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{q.khach_hang}</p>
          <p className="text-xs text-gray-400 mt-0.5">{q.ma_bao_gia} · v{q.phien_ban}</p>
          {isPending && <p className="text-xs text-amber-700 font-semibold mt-0.5">⏳ Chờ CEO/Manager duyệt</p>}
          {isSoonExpiring && <p className="text-xs text-orange-500 font-semibold mt-0.5">⚠️ Còn {daysLeft} ngày hết hạn</p>}
          {q.san_pham.length > 0 && <p className="text-xs text-gray-500 mt-1 truncate">{q.san_pham.join(', ')}</p>}
        </div>
        <StatusBadge label={displayStatus} type="b2c" />
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-sm font-bold text-blue-600">{fmtMoney(q.gia_tri_sau_ck || q.tong_gia_tri)}</span>
        {q.chiet_khau > 0 && <span className="text-xs text-orange-500 font-medium">-{q.chiet_khau}%</span>}
        {q.nguoi_phu_trach && <span className="text-xs text-gray-400">👤 {q.nguoi_phu_trach}</span>}
        {q.ngay_het_han && (
          <span className={`text-xs ml-auto ${isExpired ? 'text-red-400' : 'text-gray-300'}`}>
            HH: {fmtDate(q.ngay_het_han)}
          </span>
        )}
      </div>
    </button>
  )
}

function CommercialCard({ q, onClick }: { q: Quote; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{q.khach_hang}</p>
          <p className="text-xs text-gray-400 mt-0.5">{q.ma_bao_gia}
            {q.loai_khach ? ` · ${q.loai_khach}` : ''}
            {q.tinh_thanh ? ` · ${q.tinh_thanh}` : ''}
          </p>
          {q.san_pham.length > 0 && <p className="text-xs text-gray-500 mt-1 truncate">{q.san_pham.join(', ')}</p>}
        </div>
        <StatusBadge label={q.trang_thai} type="commercial" />
      </div>
      <div className="flex items-center gap-3 mt-3">
        <span className="text-sm font-bold text-blue-600">{fmtMoney(q.tong_gia_tri)}</span>
        {q.nguoi_phu_trach && <span className="text-xs text-gray-400">👤 {q.nguoi_phu_trach}</span>}
        {q.ngay_gui_kh && <span className="text-xs text-gray-300 ml-auto">Gửi: {fmtDate(q.ngay_gui_kh)}</span>}
      </div>
    </button>
  )
}

function ProjectCard({ q, onClick }: { q: Quote; onClick: () => void }) {
  const isWon  = q.trang_thai === 'Thắng thầu'
  const isLost = q.trang_thai === 'Thua thầu'
  return (
    <button onClick={onClick}
      className={`w-full bg-white rounded-2xl shadow-sm border p-4 text-left active:scale-[0.98] transition-transform ${
        isWon ? 'border-green-200 bg-green-50' : isLost ? 'border-red-100' : 'border-gray-100'
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{q.ten_da || q.khach_hang}</p>
          <p className="text-xs text-gray-400 mt-0.5">{q.ma_bao_gia}
            {q.chu_dau_tu ? ` · ${q.chu_dau_tu}` : ''}
          </p>
          {q.loai_da && <p className="text-xs text-gray-500 mt-0.5 truncate">{q.loai_da}{q.tinh_thanh ? ` · ${q.tinh_thanh}` : ''}</p>}
        </div>
        <StatusBadge label={q.trang_thai} type="project" />
      </div>
      <div className="flex items-center gap-3 mt-3">
        {q.gia_tri_dt > 0 && <span className="text-sm font-bold text-blue-600">{fmtMoney(q.gia_tri_dt)}</span>}
        {q.nguoi_phu_trach && <span className="text-xs text-gray-400">👤 {q.nguoi_phu_trach}</span>}
        {q.ngay_nop_thau && <span className="text-xs text-gray-300 ml-auto">Nộp: {fmtDate(q.ngay_nop_thau)}</span>}
      </div>
    </button>
  )
}

// ─── Bottom sheet primitives ──────────────────────────────────────────────────

function BottomSheet({ title, onClose, error, footer, children }: {
  title: string; onClose: () => void; children: React.ReactNode
  error?: string; footer?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 p-1">✕</button>
        </div>
        {error && (
          <div className="mx-5 mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium flex-shrink-0">
            {error}
          </div>
        )}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-600 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-600 mb-1 block">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
        {options.map(o => <option key={o} value={o}>{o || '— Chọn —'}</option>)}
      </select>
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-600 mb-1 block">{label}</label>
      <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
    </div>
  )
}

function SheetActions({ onClose, onSubmit, saving }: { onClose: () => void; onSubmit: () => void; saving: boolean }) {
  return (
    <div className="flex gap-3 pt-2 pb-2">
      <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">Huỷ</button>
      <button onClick={onSubmit} disabled={saving}
        className="flex-1 bg-blue-600 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl text-sm">
        {saving ? 'Đang lưu...' : 'Lưu'}
      </button>
    </div>
  )
}

function PickerChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
      <span className="text-xs text-blue-700 font-medium flex-1 truncate">{label}</span>
      <button onClick={onClear} className="text-blue-400 text-base leading-none flex-shrink-0">×</button>
    </div>
  )
}

// ─── Customer Picker ──────────────────────────────────────────────────────────

function CustomerPicker({ onSelect, onClose }: { onSelect: (c: Customer) => void; onClose: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [q, setQ]                 = useState('')

  useEffect(() => {
    fetch('/api/lark/customers').then(r => r.json()).then(d => setCustomers(d.customers ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = customers.filter(c => !q || (c.ho_ten + c.sdt + c.ma_kh).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-bold text-gray-800">Chọn khách hàng</h2>
      </div>
      <div className="px-4 py-3 border-b border-gray-100">
        <input autoFocus type="search" placeholder="Tìm tên, SĐT, mã KH..."
          value={q} onChange={e => setQ(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm outline-none focus:border-blue-400" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>}
        {!loading && filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-12">Không tìm thấy</p>}
        {filtered.map(c => (
          <button key={c.record_id} onClick={() => onSelect(c)}
            className="w-full px-4 py-3.5 border-b border-gray-50 text-left flex items-center gap-3 active:bg-blue-50">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-blue-600">{c.ho_ten?.[0] ?? '?'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{c.ho_ten}</p>
              <p className="text-xs text-gray-400">{c.sdt}{c.ma_kh ? ` · ${c.ma_kh}` : ''}</p>
            </div>
            <span className="text-xs text-blue-600">Chọn</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Product Picker (chỉ dùng cho B2C) ───────────────────────────────────────

function ProductThumb({ p }: { p: Product }) {
  const src = p.anh_sp || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${p.record_id}`
  const [show, setShow] = useState(true)
  if (!show) return <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><span className="text-lg">📦</span></div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 bg-gray-100" onError={() => setShow(false)} />
}

function ProductPicker({ onSelect, onClose }: { onSelect: (p: Product) => void; onClose: () => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [q, setQ]               = useState('')

  useEffect(() => {
    fetch('/api/lark/products').then(r => r.json()).then(d => setProducts(d.data ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = products.filter(p => !q || (p.ten_sp + p.ma_sp + p.phan_loai + p.nhom_sp).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-bold text-gray-800">Chọn sản phẩm</h2>
      </div>
      <div className="px-4 py-3 border-b border-gray-100">
        <input autoFocus type="search" placeholder="Tìm tên, mã, phân loại..."
          value={q} onChange={e => setQ(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm outline-none focus:border-blue-400" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>}
        {!loading && filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-12">Không tìm thấy sản phẩm</p>}
        {filtered.map(p => (
          <button key={p.record_id} onClick={() => onSelect(p)}
            className="w-full px-4 py-3.5 border-b border-gray-50 text-left flex items-center gap-3 active:bg-blue-50">
            <ProductThumb p={p} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{p.ten_sp}</p>
              <p className="text-xs text-gray-400">{p.ma_sp}{p.phan_loai ? ` · ${p.phan_loai}` : ''}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-blue-600">
                {(p.gia_chiet_khau > 0 ? p.gia_chiet_khau : p.gia_niem_yet).toLocaleString('vi-VN')}₫
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Add Forms ────────────────────────────────────────────────────────────────

const LOAI_KHACH_OPTIONS = ['', 'Đại lý', 'NPP', 'Siêu thị', 'Khác']
const LOAI_DA_OPTIONS    = ['', 'Chung cư', 'Biệt thự', 'Trường học', 'Bệnh viện', 'Khách sạn', 'Công nghiệp', 'Hành chính', 'Khác']
const PHUONG_THUC_OPTIONS = ['', 'Chuyển khoản', 'Tiền mặt', 'COD', 'Công nợ 30 ngày', 'Công nợ 60 ngày']

function AddB2CQuoteForm({ onClose, onCreated, prefilledCustomer }: {
  onClose: () => void; onCreated: (q: Quote) => void; prefilledCustomer?: Customer
}) {
  const DRAFT_KEY = 'quote_draft_quotes_page'
  const { items, total, addItem, addBlank, removeItem, changeItem, clear } = useQuoteItems(DRAFT_KEY)

  const [form, setForm] = useState({
    chiet_khau: '0', ghi_chu_ky_thuat: '', ghi_chu_thuong_mai: '',
    kenh_tiep_nhan: '', ngay_gui_kh: '',
  })
  const [customerRecordId,   setCustomerRecordId]   = useState(prefilledCustomer?.record_id ?? '')
  const [selectedCustomer,   setSelectedCustomer]   = useState<Customer | null>(prefilledCustomer ?? null)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showProductPicker,  setShowProductPicker]  = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const ck = Number(form.chiet_khau) || 0
  const afterCK = Math.round(total * (1 - ck / 100))
  const fmtM = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '0₫'

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c); setCustomerRecordId(c.record_id)
    setShowCustomerPicker(false)
  }
  const clearCustomer = () => { setSelectedCustomer(null); setCustomerRecordId('') }

  const submit = async () => {
    if (!selectedCustomer && !form.kenh_tiep_nhan) { setError('Chọn khách hàng hoặc nhập nguồn KH'); return }
    if (items.length === 0) { setError('Vui lòng thêm ít nhất 1 sản phẩm'); return }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const { san_pham } = itemsToLarkFields(items)
      const res = await fetch('/api/lark/quotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'b2c', san_pham,
          chiet_khau: ck, tong_gia_tri: total,
          ghi_chu_ky_thuat:   form.ghi_chu_ky_thuat   || undefined,
          ghi_chu_thuong_mai: form.ghi_chu_thuong_mai || undefined,
          kenh_tiep_nhan:     form.kenh_tiep_nhan     || undefined,
          ngay_gui_kh:        form.ngay_gui_kh ? new Date(form.ngay_gui_kh).getTime() : undefined,
          customer_record_id: customerRecordId || undefined,
          items: items.map(i => ({ ten_sp: i.ten_sp, don_gia: i.don_gia, so_luong: i.so_luong, product_id: i.product_id ?? null })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo báo giá'); return }
      clear(); onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <>
      {showCustomerPicker && <CustomerPicker onSelect={handleSelectCustomer} onClose={() => setShowCustomerPicker(false)} />}
      {showProductPicker && (
        <ProductPicker
          onSelect={p => { addItem({ ten_sp: p.ten_sp, don_gia: p.gia_chiet_khau || p.gia_niem_yet || 0, product_id: parseInt(p.record_id) || null }); setShowProductPicker(false) }}
          onClose={() => setShowProductPicker(false)} />
      )}
      <BottomSheet title="Tạo báo giá B2C" onClose={onClose} error={error}
        footer={<SheetActions onClose={onClose} onSubmit={submit} saving={saving} />}>
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">KHÁCH HÀNG *</label>
          {selectedCustomer
            ? <PickerChip label={`${selectedCustomer.ho_ten} · ${selectedCustomer.sdt}`} onClear={clearCustomer} />
            : <button onClick={() => setShowCustomerPicker(true)} className="w-full border-2 border-dashed border-blue-300 rounded-xl py-3 text-sm text-blue-600 font-medium">+ Chọn từ danh sách</button>
          }
        </div>
        <SelectField label="NGUỒN KH" value={form.kenh_tiep_nhan} onChange={v => set('kenh_tiep_nhan', v)} options={['', ...NGUON_KH_OPTIONS]} />
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">NGÀY GỬI KH</label>
          <input type="date" value={form.ngay_gui_kh} onChange={e => set('ngay_gui_kh', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500">SẢN PHẨM ĐỀ XUẤT *</label>
            {items.length > 0 && <button onClick={clear} className="text-xs text-red-400 font-medium">Xoá tất cả</button>}
          </div>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={item.ten_sp} onChange={e => changeItem(item.id, 'ten_sp', e.target.value)}
                    placeholder="Tên sản phẩm"
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
                    <button onClick={() => changeItem(item.id, 'so_luong', Math.max(1, item.so_luong - 1))} className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-md hover:bg-gray-100">−</button>
                    <span className="text-sm font-semibold text-gray-700 w-6 text-center">{item.so_luong}</span>
                    <button onClick={() => changeItem(item.id, 'so_luong', item.so_luong + 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-md hover:bg-gray-100">+</button>
                  </div>
                  <span className="text-gray-300 text-sm">×</span>
                  <input type="number" value={item.don_gia || ''} onChange={e => changeItem(item.id, 'don_gia', Number(e.target.value) || 0)}
                    placeholder="Đơn giá"
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <span className="text-xs font-semibold text-blue-600 flex-shrink-0 min-w-[72px] text-right">{fmtM(item.so_luong * item.don_gia)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowProductPicker(true)} className="flex-1 border-2 border-dashed border-blue-200 rounded-xl py-2.5 text-xs text-blue-600 font-semibold">+ Chọn từ danh mục</button>
            <button onClick={addBlank} className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-xs text-gray-500 font-semibold">+ Nhập thủ công</button>
          </div>
          {items.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
              <span className="text-xs text-gray-400">{items.length} sản phẩm</span>
              <span className="text-sm font-bold text-gray-800">{fmtM(total)}</span>
            </div>
          )}
        </div>
        <Field label="CHIẾT KHẤU TỔNG (%)" value={form.chiet_khau} onChange={v => set('chiet_khau', v)} placeholder="0" type="number" />
        {total > 0 && ck > 0 && (
          <div className="bg-green-50 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-xs text-gray-500">Giá sau chiết khấu</span>
            <span className="text-sm font-bold text-green-600">{fmtM(afterCK)}</span>
          </div>
        )}
        <TextArea label="GHI CHÚ KỸ THUẬT" value={form.ghi_chu_ky_thuat} onChange={v => set('ghi_chu_ky_thuat', v)} placeholder="Thông số, yêu cầu lắp đặt..." />
        <TextArea label="GHI CHÚ THƯƠNG MẠI" value={form.ghi_chu_thuong_mai} onChange={v => set('ghi_chu_thuong_mai', v)} placeholder="Điều kiện thanh toán, giao hàng..." />
      </BottomSheet>
    </>
  )
}

function AddCommercialQuoteForm({ onClose, onCreated }: { onClose: () => void; onCreated: (q: Quote) => void }) {
  const DRAFT_KEY = 'quote_draft_commercial'
  const { items, total, addItem, addBlank, removeItem, changeItem, clear } = useQuoteItems(DRAFT_KEY)

  const [form, setForm] = useState({
    loai_khach: '', tinh_thanh: '', phuong_thuc_tt: '', ghi_chu: '',
  })
  const [selectedCustomer,   setSelectedCustomer]   = useState<Customer | null>(null)
  const [customerRecordId,   setCustomerRecordId]   = useState('')
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showProductPicker,  setShowProductPicker]  = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const fmtM = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '0₫'

  const submit = async () => {
    if (!selectedCustomer) { setError('Vui lòng chọn khách hàng'); return }
    if (items.length === 0) { setError('Vui lòng thêm ít nhất 1 sản phẩm'); return }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const { san_pham } = itemsToLarkFields(items)
      const res = await fetch('/api/lark/quotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'commercial', san_pham, tong_gia_tri: total,
          loai_khach:         form.loai_khach     || undefined,
          tinh_thanh:         form.tinh_thanh     || undefined,
          phuong_thuc_tt:     form.phuong_thuc_tt || undefined,
          ghi_chu_thuong_mai: form.ghi_chu        || undefined,
          customer_record_id: customerRecordId    || undefined,
          items: items.map(i => ({ ten_sp: i.ten_sp, don_gia: i.don_gia, so_luong: i.so_luong, product_id: i.product_id ?? null })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo báo giá TM'); return }
      clear(); onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <>
      {showCustomerPicker && <CustomerPicker onSelect={c => { setSelectedCustomer(c); setCustomerRecordId(c.record_id); setShowCustomerPicker(false) }} onClose={() => setShowCustomerPicker(false)} />}
      {showProductPicker && (
        <ProductPicker
          onSelect={p => { addItem({ ten_sp: p.ten_sp, don_gia: p.gia_chiet_khau || p.gia_niem_yet || 0, product_id: parseInt(p.record_id) || null }); setShowProductPicker(false) }}
          onClose={() => setShowProductPicker(false)} />
      )}
      <BottomSheet title="Tạo báo giá Thương mại" onClose={onClose} error={error}
        footer={<SheetActions onClose={onClose} onSubmit={submit} saving={saving} />}>
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">KHÁCH HÀNG *</label>
          {selectedCustomer
            ? <PickerChip label={`${selectedCustomer.ho_ten} · ${selectedCustomer.sdt}`} onClear={() => { setSelectedCustomer(null); setCustomerRecordId('') }} />
            : <button onClick={() => setShowCustomerPicker(true)} className="w-full border-2 border-dashed border-blue-300 rounded-xl py-3 text-sm text-blue-600 font-medium">+ Chọn từ danh sách</button>
          }
        </div>
        <SelectField label="LOẠI KHÁCH" value={form.loai_khach} onChange={v => set('loai_khach', v)} options={LOAI_KHACH_OPTIONS} />
        <Field label="TỈNH / THÀNH" value={form.tinh_thanh} onChange={v => set('tinh_thanh', v)} placeholder="TP. Hồ Chí Minh" />
        <SelectField label="PHƯƠNG THỨC THANH TOÁN" value={form.phuong_thuc_tt} onChange={v => set('phuong_thuc_tt', v)} options={PHUONG_THUC_OPTIONS} />
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500">SẢN PHẨM / VẬT TƯ *</label>
            {items.length > 0 && <button onClick={clear} className="text-xs text-red-400 font-medium">Xoá tất cả</button>}
          </div>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={item.ten_sp} onChange={e => changeItem(item.id, 'ten_sp', e.target.value)} placeholder="Tên sản phẩm / vật tư"
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
                    <button onClick={() => changeItem(item.id, 'so_luong', Math.max(1, item.so_luong - 1))} className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-md hover:bg-gray-100">−</button>
                    <span className="text-sm font-semibold text-gray-700 w-6 text-center">{item.so_luong}</span>
                    <button onClick={() => changeItem(item.id, 'so_luong', item.so_luong + 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-md hover:bg-gray-100">+</button>
                  </div>
                  <span className="text-gray-300 text-sm">×</span>
                  <input type="number" value={item.don_gia || ''} onChange={e => changeItem(item.id, 'don_gia', Number(e.target.value) || 0)} placeholder="Đơn giá"
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <span className="text-xs font-semibold text-blue-600 flex-shrink-0 min-w-[72px] text-right">{fmtM(item.so_luong * item.don_gia)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowProductPicker(true)} className="flex-1 border-2 border-dashed border-blue-200 rounded-xl py-2.5 text-xs text-blue-600 font-semibold">+ Chọn từ danh mục</button>
            <button onClick={addBlank} className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-xs text-gray-500 font-semibold">+ Nhập thủ công</button>
          </div>
          {items.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
              <span className="text-xs text-gray-400">{items.length} mặt hàng</span>
              <span className="text-sm font-bold text-gray-800">{fmtM(total)}</span>
            </div>
          )}
        </div>
        <TextArea label="GHI CHÚ" value={form.ghi_chu} onChange={v => set('ghi_chu', v)} placeholder="Điều khoản, giao hàng..." />
      </BottomSheet>
    </>
  )
}

function AddProjectQuoteForm({ onClose, onCreated }: { onClose: () => void; onCreated: (q: Quote) => void }) {
  const [form, setForm] = useState({
    ten_da: '', chu_dau_tu: '', loai_da: '', quy_mo: '',
    tinh_thanh: '', gia_tri_dt: '', ngay_nop_thau: '', doi_tac_da: '', ghi_chu: '',
  })
  const [selectedCustomer,   setSelectedCustomer]   = useState<Customer | null>(null)
  const [customerRecordId,   setCustomerRecordId]   = useState('')
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.ten_da.trim()) { setError('Tên dự án là bắt buộc'); return }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/lark/quotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'project',
          ten_da:        form.ten_da,
          chu_dau_tu:    form.chu_dau_tu    || undefined,
          loai_da:       form.loai_da       || undefined,
          quy_mo:        form.quy_mo        || undefined,
          tinh_thanh:    form.tinh_thanh    || undefined,
          gia_tri_dt:    form.gia_tri_dt ? Number(form.gia_tri_dt) : undefined,
          ngay_nop_thau: form.ngay_nop_thau ? new Date(form.ngay_nop_thau).getTime() : undefined,
          doi_tac_da:    form.doi_tac_da    || undefined,
          ghi_chu_ky_thuat: form.ghi_chu   || undefined,
          customer_record_id: customerRecordId || undefined,
          tong_gia_tri:  form.gia_tri_dt ? Number(form.gia_tri_dt) : 0,
          items: [],
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo hồ sơ dự án'); return }
      onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <>
      {showCustomerPicker && <CustomerPicker onSelect={c => { setSelectedCustomer(c); setCustomerRecordId(c.record_id); setShowCustomerPicker(false) }} onClose={() => setShowCustomerPicker(false)} />}
      <BottomSheet title="Tạo hồ sơ Dự án" onClose={onClose} error={error}
        footer={<SheetActions onClose={onClose} onSubmit={submit} saving={saving} />}>
        <Field label="TÊN DỰ ÁN *" value={form.ten_da} onChange={v => set('ten_da', v)} placeholder="Hệ thống lọc nước toà nhà ABC" />
        <Field label="CHỦ ĐẦU TƯ" value={form.chu_dau_tu} onChange={v => set('chu_dau_tu', v)} placeholder="Công ty TNHH XYZ" />
        <SelectField label="LOẠI DỰ ÁN" value={form.loai_da} onChange={v => set('loai_da', v)} options={LOAI_DA_OPTIONS} />
        <Field label="QUY MÔ" value={form.quy_mo} onChange={v => set('quy_mo', v)} placeholder="500 hộ dân, 10 tầng..." />
        <Field label="TỈNH / THÀNH" value={form.tinh_thanh} onChange={v => set('tinh_thanh', v)} placeholder="Hà Nội" />
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">GIÁ TRỊ DỰ TOÁN (₫)</label>
          <input type="number" value={form.gia_tri_dt} onChange={e => set('gia_tri_dt', e.target.value)} placeholder="500000000"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">NGÀY NỘP THẦU</label>
          <input type="date" value={form.ngay_nop_thau} onChange={e => set('ngay_nop_thau', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <Field label="ĐỐI TÁC THAM GIA" value={form.doi_tac_da} onChange={v => set('doi_tac_da', v)} placeholder="Công ty thi công, đơn vị tư vấn..." />
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">LIÊN KẾT KHÁCH HÀNG</label>
          {selectedCustomer
            ? <PickerChip label={`${selectedCustomer.ho_ten} · ${selectedCustomer.sdt}`} onClear={() => { setSelectedCustomer(null); setCustomerRecordId('') }} />
            : <button onClick={() => setShowCustomerPicker(true)} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 font-medium">+ Liên kết khách hàng (tuỳ chọn)</button>
          }
        </div>
        <TextArea label="GHI CHÚ" value={form.ghi_chu} onChange={v => set('ghi_chu', v)} placeholder="Yêu cầu đặc thù, hồ sơ cần thiết..." />
      </BottomSheet>
    </>
  )
}

// ─── useQuoteData per tab ─────────────────────────────────────────────────────

function useTabQuoteData(type: QuoteType) {
  const [data,    setData]    = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [total,   setTotal]   = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page,    setPage]    = useState(1)

  const fetchData = useCallback(async (p: number, append = false) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/lark/quotes?type=${type}&page=${p}&pageSize=50`)
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Lỗi tải'); return }
      const rows = json.data ?? []
      setData(prev => append ? [...prev, ...rows] : rows)
      setTotal(json.meta?.total ?? rows.length)
      setHasMore(json.meta?.hasMore ?? false)
    } catch { setError('Lỗi kết nối') }
    finally { setLoading(false) }
  }, [type])

  useEffect(() => { fetchData(1) }, [fetchData])

  const reload   = () => { setPage(1); fetchData(1) }
  const loadMore = () => { const next = page + 1; setPage(next); fetchData(next, true) }

  return { data, setData, loading, error, total, hasMore, reload, loadMore }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = QuoteType

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'b2c',        label: 'Báo giá',    icon: '📋' },
  { key: 'commercial', label: 'Thương mại', icon: '🏪' },
  { key: 'project',    label: 'Dự án',      icon: '🏗️' },
]

export default function QuotesPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const urlTab = searchParams.get('tab') as Tab | null
  const initTab: Tab = urlTab && ['b2c', 'commercial', 'project'].includes(urlTab) ? urlTab : 'b2c'

  const [tab,          setTab]          = useState<Tab>(initTab)
  const [myRole,       setMyRole]       = useState('')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm,     setShowForm]     = useState(false)

  // B2C dùng hook cũ (hỗ trợ follow-up / pull-to-refresh)
  const b2cHook = useQuoteData()
  // Commercial + Project dùng hook mới per-type
  const tmHook  = useTabQuoteData('commercial')
  const daHook  = useTabQuoteData('project')

  const activeHook = tab === 'b2c' ? b2cHook : tab === 'commercial' ? tmHook : daHook
  const { data, setData, loading, error, reload, loadMore, hasMore, total } = activeHook

  const ptr = usePullToRefresh(async () => { reload() })

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setMyRole(d?.role ?? '')).catch(() => {})
  }, [])

  // Reset filter khi đổi tab
  useEffect(() => { setStatusFilter('all'); setSearch('') }, [tab])

  const canCreate = ['admin', 'ceo', 'director', 'sales'].includes(myRole)

  const countLabel =
    tab === 'b2c'        ? `${total} báo giá` :
    tab === 'commercial' ? `${total} đơn TM`  :
    `${total} dự án`

  const statusFilters = ['all', ...STATUSES_BY_TYPE[tab]]

  // Client-side filter
  const filtered = useCallback(() => {
    const now = Date.now()
    return data.filter(q => {
      if (search) {
        const s = search.toLowerCase()
        const match = (q.ma_bao_gia + q.khach_hang + q.san_pham.join(' ') + q.ten_da + q.chu_dau_tu).toLowerCase()
        if (!match.includes(s)) return false
      }
      if (statusFilter !== 'all') {
        const isExpired = tab === 'b2c' && q.ngay_het_han && now > q.ngay_het_han
          && !['Chấp nhận', 'Từ chối'].includes(q.trang_thai)
        const displayStatus = isExpired ? 'Hết hạn' : q.trang_thai
        if (displayStatus !== statusFilter) return false
      }
      return true
    })
  }, [data, search, statusFilter, tab])

  const items = filtered()
  const followUpCount = tab === 'b2c' ? data.filter(isDueForFollowUp).length : 0

  const countByStatus: Record<string, number> = {}
  const now = Date.now()
  data.forEach(q => {
    const isExpired = tab === 'b2c' && q.ngay_het_han && now > q.ngay_het_han
      && !['Chấp nhận', 'Từ chối'].includes(q.trang_thai)
    const s = isExpired ? 'Hết hạn' : q.trang_thai
    countByStatus[s] = (countByStatus[s] ?? 0) + 1
  })

  const handleCreated = (q: Quote) => { setData(prev => [q, ...prev]); setShowForm(false) }

  const getDetailPath = (q: Quote) => `/dashboard/quotes/${q.record_id}`

  const emptyIcon  = tab === 'b2c' ? '📋' : tab === 'commercial' ? '🏪' : '🏗️'
  const emptyLabel = tab === 'b2c' ? 'Chưa có báo giá nào' : tab === 'commercial' ? 'Chưa có đơn thương mại' : 'Chưa có hồ sơ dự án'
  const createLabel = tab === 'b2c' ? '+ Tạo báo giá đầu tiên' : tab === 'commercial' ? '+ Tạo đơn thương mại đầu tiên' : '+ Tạo hồ sơ dự án đầu tiên'
  const createBtn   = tab === 'b2c' ? '+ Tạo BG' : tab === 'commercial' ? '+ Tạo đơn TM' : '+ Tạo dự án'

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Báo giá</h1>
            <p className="text-xs text-gray-400">
              {loading ? 'Đang tải...' : countLabel}
              {followUpCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {followUpCount} follow-up
                </span>
              )}
            </p>
          </div>
          {canCreate && (
            <button onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5">
              <span className="text-base leading-none">+</span> {tab === 'b2c' ? 'Tạo BG' : tab === 'commercial' ? 'Tạo TM' : 'Tạo DA'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
                tab === t.key
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search + filters */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2.5">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={tab === 'b2c' ? 'Tìm tên KH, mã BG, sản phẩm...' : tab === 'commercial' ? 'Tìm tên KH, mã TM...' : 'Tìm tên dự án, chủ đầu tư...'}
            value={search} onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">✕</button>}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {statusFilters.map(s => {
            const count = s === 'all' ? data.length : (countByStatus[s] ?? 0)
            const isActive = statusFilter === s
            const isPending = s === 'Chờ duyệt' && (countByStatus['Chờ duyệt'] ?? 0) > 0 && !isActive
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  isActive ? 'bg-blue-600 text-white border-blue-600' :
                  isPending ? 'bg-amber-50 text-amber-700 border-amber-300' :
                  'bg-white text-gray-500 border-gray-200'
                }`}>
                <span>{s === 'all' ? 'Tất cả' : s}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1 rounded-full ${isActive ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" onTouchStart={ptr.onTouchStart} onTouchMove={ptr.onTouchMove} onTouchEnd={ptr.onTouchEnd}>
        <PullIndicator dist={ptr.dist} refreshing={ptr.refreshing} />
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
              <span className="crm-spinner" /><span>Đang tải...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 text-sm mb-3">{error}</p>
              <button onClick={reload} className="text-blue-600 text-sm font-semibold">Thử lại</button>
            </div>
          ) : (
            <>
              {tab === 'b2c' && !search && statusFilter === 'all' && (
                <QuoteFollowUpBanner quotes={data} onClickQuote={id => router.push(`/dashboard/quotes/${id}`)} />
              )}

              {items.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <span className="text-4xl">{search || statusFilter !== 'all' ? '🔍' : emptyIcon}</span>
                  <p className="text-sm font-medium text-gray-500">
                    {search || statusFilter !== 'all' ? 'Không tìm thấy kết quả' : emptyLabel}
                  </p>
                  {canCreate && !search && statusFilter === 'all' && (
                    <button onClick={() => setShowForm(true)} className="mt-2 text-sm text-blue-600 font-semibold bg-blue-50 px-4 py-2 rounded-xl">
                      {createLabel}
                    </button>
                  )}
                </div>
              ) : (
                items.map(q => {
                  const onClick = () => router.push(getDetailPath(q))
                  if (tab === 'commercial') return <CommercialCard key={q.record_id} q={q} onClick={onClick} />
                  if (tab === 'project')    return <ProjectCard    key={q.record_id} q={q} onClick={onClick} />
                  return <B2CCard key={q.record_id} q={q} onClick={onClick} />
                })
              )}

              {hasMore && !search && statusFilter === 'all' && (
                <button onClick={loadMore} className="w-full py-3 text-sm text-blue-600 font-semibold text-center border border-blue-100 rounded-2xl bg-blue-50 active:bg-blue-100">
                  Tải thêm ({total - data.length} còn lại)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add forms */}
      {showForm && tab === 'b2c'        && <AddB2CQuoteForm        onClose={() => setShowForm(false)} onCreated={handleCreated} />}
      {showForm && tab === 'commercial' && <AddCommercialQuoteForm  onClose={() => setShowForm(false)} onCreated={handleCreated} />}
      {showForm && tab === 'project'    && <AddProjectQuoteForm     onClose={() => setShowForm(false)} onCreated={handleCreated} />}
    </div>
  )
}
