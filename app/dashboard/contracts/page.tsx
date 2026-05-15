'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { usePullToRefresh, PullIndicator } from '@/components/PullToRefresh'
import {
  CONTRACT_STATUS_COLORS,
  COMMERCIAL_STATUS_COLORS,
  PROJECT_STAGE_COLORS,
  NGUON_KH_OPTIONS,
  LOAI_KHACH_OPTIONS,
  LOAI_DU_AN_OPTIONS,
  PHUONG_THUC_TT_OPTIONS,
} from '@/lib/lark/tables'
import type { Contract, CommercialOrder, Project } from '@/app/api/lark/orders/route'
import type { Customer } from '@/app/api/lark/customers/route'
import type { Product } from '@/app/api/lark/products/_mapper'
import type { Quote } from '@/app/api/lark/quotes/_mappers'
import CustomerPicker from '@/components/CustomerPicker'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '—'

const fmtDate = (ms: number | null) => {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const fmtDateStr = (s: string | number | null | undefined) => {
  if (!s) return '—'
  const d = typeof s === 'number' ? new Date(s) : new Date(s)
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function StatusBadge({ label, colors }: { label: string; colors: Record<string, { bg: string; text: string }> }) {
  const c = colors[label] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${c.bg} ${c.text}`}>
      {label}
    </span>
  )
}

// ─── Shared form primitives ───────────────────────────────────────────────────

function BottomSheet({ title, onClose, error, footer, children }: {
  title: string; onClose: () => void; children: React.ReactNode
  error?: string; footer?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
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

function Field({ label, value, onChange, placeholder, type = 'text', readOnly }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-600 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${readOnly ? 'bg-gray-50 text-gray-700' : ''}`} />
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

// ─── Product Picker ───────────────────────────────────────────────────────────

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

function ProductPicker({ onSelect, onClose, priceLabel }: {
  onSelect: (p: Product) => void
  onClose: () => void
  priceLabel?: string
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [q, setQ]               = useState('')

  useEffect(() => {
    fetch('/api/lark/products')
      .then(r => r.json())
      .then(d => setProducts(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = products.filter(p => {
    if (!q) return true
    const s = (p.ten_sp + p.ma_sp + p.phan_loai + p.nhom_sp).toLowerCase()
    return s.includes(q.toLowerCase())
  })

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-gray-800">Chọn sản phẩm</h2>
          {priceLabel && <p className="text-xs text-blue-600">Giá sẽ áp dụng: {priceLabel}</p>}
        </div>
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
              {p.hh_kd > 0 && <p className="text-xs text-gray-400">HH {p.hh_kd}%</p>}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Quote Picker ─────────────────────────────────────────────────────────────

function QuotePicker({ onSelect, onClose }: {
  onSelect: (q: Quote) => void
  onClose:  () => void
}) {
  const [quotes,  setQuotes]  = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [q,       setQ]       = useState('')

  useEffect(() => {
    fetch('/api/lark/quotes?type=b2c&pageSize=100')
      .then(r => r.json())
      .then(d => {
        const all: Quote[] = d.data ?? []
        setQuotes(all.filter(x => x.trang_thai === 'Chấp nhận' && !x.ma_hd_tham_chieu))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = quotes.filter(qt => {
    if (!q) return true
    return (qt.ma_bao_gia + qt.khach_hang).toLowerCase().includes(q.toLowerCase())
  })

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-gray-800">Chọn từ báo giá</h2>
          <p className="text-xs text-gray-400">Chỉ hiển thị BG đã Chấp nhận chưa tạo HĐ</p>
        </div>
      </div>
      <div className="px-4 py-3 border-b border-gray-100">
        <input autoFocus type="search" placeholder="Tìm mã BG, tên khách hàng..."
          value={q} onChange={e => setQ(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm outline-none focus:border-blue-400" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
            <span className="crm-spinner" /><span>Đang tải...</span>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-12">
            Không có báo giá Chấp nhận nào chưa tạo HĐ
          </p>
        )}
        {filtered.map(qt => (
          <button key={qt.record_id} onClick={() => onSelect(qt)}
            className="w-full px-4 py-3.5 border-b border-gray-50 text-left active:bg-blue-50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-600">{qt.ma_bao_gia}</p>
                <p className="text-sm text-gray-700 font-medium truncate">{qt.khach_hang}</p>
                {qt.san_pham.length > 0 && (
                  <p className="text-xs text-gray-400 truncate">
                    {qt.san_pham.slice(0, 2).join(', ')}{qt.san_pham.length > 2 ? ` +${qt.san_pham.length - 2} SP` : ''}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-green-700">
                  {fmtMoney(qt.gia_tri_sau_ck || qt.tong_gia_tri)}
                </p>
                {qt.ngay_lap && (
                  <p className="text-xs text-gray-400">{fmtDateStr(qt.ngay_lap)}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Picker chip ──────────────────────────────────────────────────────────────

function PickerChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
      <span className="text-xs text-blue-700 font-medium flex-1 truncate">{label}</span>
      <button onClick={onClear} className="text-blue-400 text-base leading-none flex-shrink-0">×</button>
    </div>
  )
}

function priceForLoaiKhach(p: Product, loai: string): number {
  if (loai === 'Nhà phân phối') return p.gia_npp || p.gia_dai_ly || p.gia_chiet_khau
  if (loai.startsWith('Đại lý'))  return p.gia_dai_ly || p.gia_chiet_khau
  return p.gia_chiet_khau || p.gia_niem_yet
}

function priceKeyLabel(loai: string): string {
  if (loai === 'Nhà phân phối') return 'Giá NPP'
  if (loai.startsWith('Đại lý'))  return 'Giá đại lý'
  return 'Giá chiết khấu'
}

// ─── Add Forms ────────────────────────────────────────────────────────────────

type QuoteLineItem = { id: number; ten_sp: string; don_gia: number; so_luong: number }

function AddContractForm({
  onClose, onCreated,
  fromQuoteRecordId = '', initialKhachHang = '',
  initialSdt = '', initialGiaTri = '', initialDiaChiCt = '',
}: {
  onClose:            () => void
  onCreated:          (c: Contract) => void
  fromQuoteRecordId?: string
  initialKhachHang?:  string
  initialSdt?:        string
  initialGiaTri?:     string
  initialDiaChiCt?:   string
}) {
  const [form, setForm] = useState({
    khach_hang: initialKhachHang, sdt: initialSdt,
    san_pham: '', gia_tri_hd: initialGiaTri,
    dia_chi_ct: initialDiaChiCt, ghi_chu: '',
  })
  const [customerRecordId,   setCustomerRecordId]   = useState('')
  const [selectedCustomer,   setSelectedCustomer]   = useState<Customer | null>(null)
  const [selectedProduct,    setSelectedProduct]    = useState<Product | null>(null)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showProductPicker,  setShowProductPicker]  = useState(false)
  // ── Quote picker state ────────────────────────────────────────────────────
  const [showQuotePicker,    setShowQuotePicker]    = useState(false)
  const [selectedQuote,      setSelectedQuote]      = useState<Quote | null>(null)
  const [quoteItems,         setQuoteItems]         = useState<QuoteLineItem[]>([])
  const [fromQuoteId,        setFromQuoteId]        = useState(fromQuoteRecordId)
  // ─────────────────────────────────────────────────────────────────────────
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')
  const [warnMsg, setWarnMsg] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c); setCustomerRecordId(c.record_id)
    setForm(f => ({ ...f, khach_hang: c.ho_ten, sdt: c.sdt, dia_chi_ct: c.dia_chi_ct || c.dia_chi_hd || f.dia_chi_ct }))
    setShowCustomerPicker(false)
  }
  const clearCustomer = () => {
    setSelectedCustomer(null); setCustomerRecordId('')
    setForm(f => ({ ...f, khach_hang: '', sdt: '' }))
  }

  const handleSelectProduct = (p: Product) => {
    if (quoteItems.length > 0) {
      // Thêm vào danh sách SP từ BG
      setQuoteItems(prev => [...prev, { id: Date.now(), ten_sp: p.ten_sp, don_gia: p.gia_niem_yet, so_luong: 1 }])
    } else {
      setSelectedProduct(p)
      setForm(f => ({ ...f, san_pham: p.ten_sp, gia_tri_hd: f.gia_tri_hd || (p.gia_niem_yet > 0 ? String(p.gia_niem_yet) : '') }))
    }
    setShowProductPicker(false)
  }

  const handleSelectQuote = async (q: Quote) => {
    setSelectedQuote(q)
    setFromQuoteId(q.record_id)
    setShowQuotePicker(false)
    setForm(f => ({
      ...f,
      khach_hang: q.khach_hang || f.khach_hang,
      sdt:        q.sdt        || f.sdt,
      gia_tri_hd: (q.gia_tri_sau_ck || q.tong_gia_tri)
                    ? String(q.gia_tri_sau_ck || q.tong_gia_tri)
                    : f.gia_tri_hd,
      dia_chi_ct: q.dia_chi_ct || f.dia_chi_ct,
    }))
    // Tải items chi tiết từ API
    try {
      const res  = await fetch(`/api/lark/quotes/${q.record_id}`)
      const data = await res.json()
      if (data.data?.items?.length) setQuoteItems(data.data.items)
    } catch { /* ignore */ }
  }
  const clearQuote = () => {
    setSelectedQuote(null)
    setFromQuoteId(fromQuoteRecordId)
    setQuoteItems([])
  }

  // Tổng tiền hiển thị từ quoteItems
  const quoteItemsTotal = quoteItems.reduce((s, i) => s + i.don_gia * i.so_luong, 0)

  // san_pham gửi lên API
  const buildSanPham = () => {
    if (quoteItems.length > 0) return quoteItems.map(i => i.so_luong > 1 ? `${i.ten_sp} (${i.so_luong}x)` : i.ten_sp)
    if (selectedProduct) return [selectedProduct.ten_sp]
    return form.san_pham ? [form.san_pham] : []
  }

  const submit = async () => {
    if (!form.khach_hang || !form.gia_tri_hd) { setError('Tên KH và giá trị HĐ là bắt buộc'); return }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/lark/orders?tab=b2c', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          san_pham:           buildSanPham(),
          gia_tri_hd:         Number(String(form.gia_tri_hd).replace(/\D/g, '')),
          customer_id:        selectedCustomer?.id  || undefined,
          customer_record_id: customerRecordId      || undefined,
          quote_record_id:    fromQuoteId           || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo HĐ'); return }
      if (data.warnings?.length) {
        setWarnMsg(data.warnings.join(' | '))
        await new Promise(r => setTimeout(r, 1800))
      }
      onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <>
      {showCustomerPicker && <CustomerPicker onSelect={handleSelectCustomer} onClose={() => setShowCustomerPicker(false)} />}
      {showProductPicker  && <ProductPicker  onSelect={handleSelectProduct}  onClose={() => setShowProductPicker(false)} />}
      {showQuotePicker    && <QuotePicker    onSelect={handleSelectQuote}    onClose={() => setShowQuotePicker(false)} />}
      <BottomSheet title="Tạo hợp đồng B2C" onClose={onClose} error={error}
        footer={<SheetActions onClose={onClose} onSubmit={submit} saving={saving} />}>
        {warnMsg && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium flex items-start gap-2">
            <span>⚠️</span><span>{warnMsg}</span>
          </div>
        )}

        {/* ── Liên kết báo giá (tuỳ chọn) ───────────────────────────────── */}
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">
            LIÊN KẾT BÁO GIÁ <span className="font-normal text-gray-400">(tuỳ chọn)</span>
          </label>
          {selectedQuote ? (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-blue-700">{selectedQuote.ma_bao_gia}</p>
                <p className="text-xs text-blue-600 truncate">
                  {selectedQuote.khach_hang} · {fmtMoney(selectedQuote.gia_tri_sau_ck || selectedQuote.tong_gia_tri)}
                  {quoteItems.length > 0 && ` · ${quoteItems.length} SP`}
                </p>
              </div>
              <button onClick={clearQuote} className="text-blue-400 text-lg leading-none flex-shrink-0">×</button>
            </div>
          ) : (
            <button onClick={() => setShowQuotePicker(true)}
              className="w-full border-2 border-dashed border-blue-300 rounded-xl py-3 text-sm text-blue-600 font-medium flex items-center justify-center gap-2">
              <span>📋</span><span>Chọn từ danh sách báo giá đã duyệt</span>
            </button>
          )}
        </div>

        {/* ── Khách hàng ─────────────────────────────────────────────────── */}
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">KHÁCH HÀNG *</label>
          {selectedCustomer ? (
            <PickerChip label={`${selectedCustomer.ho_ten} · ${selectedCustomer.sdt}`} onClear={clearCustomer} />
          ) : (
            <button onClick={() => setShowCustomerPicker(true)}
              className="w-full border-2 border-dashed border-blue-300 rounded-xl py-3 text-sm text-blue-600 font-medium">
              + Chọn từ danh sách khách hàng
            </button>
          )}
        </div>
        <Field label="TÊN KHÁCH HÀNG *" value={form.khach_hang} onChange={v => set('khach_hang', v)} placeholder="Hoặc nhập tay nếu chưa có trong hệ thống" />
        <Field label="SỐ ĐIỆN THOẠI" value={form.sdt} onChange={v => set('sdt', v)} placeholder="0901234567" type="tel" />

        {/* ── Sản phẩm ───────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-semibold text-gray-600">SẢN PHẨM CHÍNH</label>
            {quoteItems.length > 0 && (
              <button onClick={() => setShowProductPicker(true)}
                className="text-xs text-blue-600 font-semibold">+ Thêm SP</button>
            )}
          </div>
          {quoteItems.length > 0 ? (
            <div className="space-y-1.5">
              {quoteItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{item.ten_sp}</p>
                    <p className="text-xs text-gray-400">
                      {item.so_luong} × {item.don_gia.toLocaleString('vi-VN')}₫
                      {' '}= {(item.don_gia * item.so_luong).toLocaleString('vi-VN')}₫
                    </p>
                  </div>
                  <button onClick={() => setQuoteItems(prev => prev.filter((_, i) => i !== idx))}
                    className="text-gray-400 text-base leading-none flex-shrink-0 p-1">×</button>
                </div>
              ))}
              {quoteItemsTotal > 0 && (
                <div className="bg-green-50 rounded-xl px-3 py-2 flex justify-between items-center">
                  <span className="text-xs text-green-600 font-medium">Tổng từ BG</span>
                  <span className="text-sm font-bold text-green-700">{quoteItemsTotal.toLocaleString('vi-VN')}₫</span>
                </div>
              )}
            </div>
          ) : selectedProduct ? (
            <PickerChip label={`${selectedProduct.ten_sp} · ${fmtMoney(selectedProduct.gia_niem_yet)}`}
              onClear={() => { setSelectedProduct(null); set('san_pham', '') }} />
          ) : (
            <button onClick={() => setShowProductPicker(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 font-medium">
              + Chọn từ danh mục sản phẩm
            </button>
          )}
        </div>

        <Field label="GIÁ TRỊ HĐ (VNĐ) *" value={form.gia_tri_hd} onChange={v => set('gia_tri_hd', v)} placeholder="65000000" type="number" />
        <Field label="ĐỊA CHỈ CÔNG TRÌNH" value={form.dia_chi_ct} onChange={v => set('dia_chi_ct', v)} placeholder="Số nhà, đường, quận..." />
        <TextArea label="GHI CHÚ" value={form.ghi_chu} onChange={v => set('ghi_chu', v)} placeholder="Ghi chú thêm..." />
      </BottomSheet>
    </>
  )
}

function AddCommercialForm({
  onClose, onCreated,
  fromQuoteRecordId = '', initialTenKh = '', initialSdt = '', initialGiaTri = '',
}: {
  onClose:             () => void
  onCreated:           (c: CommercialOrder) => void
  fromQuoteRecordId?:  string
  initialTenKh?:       string
  initialSdt?:         string
  initialGiaTri?:      string
}) {
  const [form, setForm] = useState({
    ten_kh: initialTenKh, sdt: initialSdt, san_pham: '', so_luong: '', don_gia: initialGiaTri,
    loai_khach: 'Đại lý cấp 1', tinh_thanh: '', phuong_thuc_tt: 'Chuyển khoản', ghi_chu: '',
  })
  const [selectedProduct,   setSelectedProduct]   = useState<Product | null>(null)
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [selectedCustomer,  setSelectedCustomer]  = useState<Customer | null>(null)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [customerId, setCustomerId] = useState<number | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c)
    setCustomerId(c.id)
    setForm(f => ({ ...f, ten_kh: c.ho_ten, sdt: c.sdt || f.sdt }))
    setShowCustomerPicker(false)
  }

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p)
    const price = priceForLoaiKhach(p, form.loai_khach)
    setForm(f => ({ ...f, san_pham: p.ten_sp, don_gia: price > 0 ? String(price) : f.don_gia }))
    setShowProductPicker(false)
  }
  const handleLoaiKhach = (v: string) => {
    set('loai_khach', v)
    if (selectedProduct) {
      const price = priceForLoaiKhach(selectedProduct, v)
      if (price > 0) set('don_gia', String(price))
    }
  }
  const tong = form.so_luong && form.don_gia
    ? (Number(form.so_luong) * Number(form.don_gia)).toLocaleString('vi-VN') + '₫' : ''

  const submit = async () => {
    if (!form.ten_kh || !form.san_pham || !form.so_luong || !form.don_gia) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc'); return
    }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/lark/orders?tab=commercial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          so_luong:         Number(form.so_luong),
          don_gia:          Number(form.don_gia),
          customer_id:      customerId,
          quote_record_id:  fromQuoteRecordId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo đơn'); return }
      onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <>
      {showProductPicker && (
        <ProductPicker onSelect={handleSelectProduct} onClose={() => setShowProductPicker(false)} priceLabel={priceKeyLabel(form.loai_khach)} />
      )}
      {showCustomerPicker && (
        <CustomerPicker onSelect={handleSelectCustomer} onClose={() => setShowCustomerPicker(false)} />
      )}
      <BottomSheet title="Tạo đơn thương mại" onClose={onClose} error={error}
        footer={<SheetActions onClose={onClose} onSubmit={submit} saving={saving} />}>
        <SelectField label="LOẠI KHÁCH" value={form.loai_khach} onChange={handleLoaiKhach} options={[...LOAI_KHACH_OPTIONS]} />
        {/* Liên kết KH (tuỳ chọn) */}
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">LIÊN KẾT KHÁCH HÀNG <span className="font-normal text-gray-400">(tuỳ chọn)</span></label>
          {selectedCustomer ? (
            <PickerChip label={`${selectedCustomer.ho_ten} · ${selectedCustomer.sdt}`} onClear={() => { setSelectedCustomer(null); setCustomerId(undefined) }} />
          ) : (
            <button onClick={() => setShowCustomerPicker(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-500 font-medium">
              👤 Chọn hoặc tạo khách hàng
            </button>
          )}
        </div>
        <Field label="TÊN KHÁCH HÀNG / ĐẠI LÝ *" value={form.ten_kh} onChange={v => set('ten_kh', v)} placeholder="Cửa hàng Minh Đức" />
        <Field label="SỐ ĐIỆN THOẠI" value={form.sdt} onChange={v => set('sdt', v)} placeholder="0901234567" type="tel" />
        <Field label="TỈNH / THÀNH PHỐ" value={form.tinh_thanh} onChange={v => set('tinh_thanh', v)} placeholder="Hà Nội" />
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">SẢN PHẨM / VẬT TƯ *</label>
          {selectedProduct ? (
            <PickerChip label={`${selectedProduct.ten_sp} · ${priceKeyLabel(form.loai_khach)}: ${fmtMoney(priceForLoaiKhach(selectedProduct, form.loai_khach))}`}
              onClear={() => { setSelectedProduct(null); set('san_pham', ''); set('don_gia', '') }} />
          ) : (
            <button onClick={() => setShowProductPicker(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 font-medium mb-1">
              + Chọn từ danh mục sản phẩm
            </button>
          )}
          {!selectedProduct && (
            <input type="text" value={form.san_pham} onChange={e => set('san_pham', e.target.value)}
              placeholder="Hoặc nhập tên sản phẩm..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SỐ LƯỢNG *" value={form.so_luong} onChange={v => set('so_luong', v)} placeholder="20" type="number" />
          <Field label="ĐƠN GIÁ *" value={form.don_gia} onChange={v => set('don_gia', v)} placeholder="680000" type="number" />
        </div>
        {tong && <div className="bg-green-50 rounded-xl px-4 py-2.5"><p className="text-sm font-bold text-green-700">Tổng tiền: {tong}</p></div>}
        <SelectField label="PHƯƠNG THỨC THANH TOÁN" value={form.phuong_thuc_tt} onChange={v => set('phuong_thuc_tt', v)} options={[...PHUONG_THUC_TT_OPTIONS]} />
        <TextArea label="GHI CHÚ" value={form.ghi_chu} onChange={v => set('ghi_chu', v)} placeholder="Ghi chú thêm..." />
      </BottomSheet>
    </>
  )
}

function AddProjectForm({
  onClose, onCreated,
  fromQuoteRecordId = '', initialTenDa = '', initialChuDauTu = '', initialGiaTri = '',
}: {
  onClose:             () => void
  onCreated:           (p: Project) => void
  fromQuoteRecordId?:  string
  initialTenDa?:       string
  initialChuDauTu?:    string
  initialGiaTri?:      string
}) {
  const [form, setForm] = useState({
    ten_da: initialTenDa, chu_dau_tu: initialChuDauTu, loai_da: '', quy_mo: '',
    tinh_thanh: '', gia_tri_dt: initialGiaTri, ty_le_thang: '50', ghi_chu: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [selectedCustomer,   setSelectedCustomer]   = useState<Customer | null>(null)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [customerId, setCustomerId] = useState<number | undefined>(undefined)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c)
    setCustomerId(c.id)
    setForm(f => ({ ...f, chu_dau_tu: c.ho_ten }))
    setShowCustomerPicker(false)
  }

  const submit = async () => {
    if (!form.ten_da || !form.chu_dau_tu) { setError('Tên dự án và chủ đầu tư là bắt buộc'); return }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/lark/orders?tab=projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          gia_tri_dt:       Number(form.gia_tri_dt),
          ty_le_thang:      Number(form.ty_le_thang),
          customer_id:      customerId,
          quote_record_id:  fromQuoteRecordId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo dự án'); return }
      onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <>
      {showCustomerPicker && (
        <CustomerPicker onSelect={handleSelectCustomer} onClose={() => setShowCustomerPicker(false)} />
      )}
      <BottomSheet title="Tạo dự án B2B" onClose={onClose} error={error}
        footer={<SheetActions onClose={onClose} onSubmit={submit} saving={saving} />}>
      <Field label="TÊN DỰ ÁN *" value={form.ten_da} onChange={v => set('ten_da', v)} placeholder="Hệ thống lọc nước Resort..." />
      {/* Liên kết KH (tuỳ chọn) */}
      <div>
        <label className="text-sm font-semibold text-gray-600 mb-1 block">LIÊN KẾT KHÁCH HÀNG <span className="font-normal text-gray-400">(tuỳ chọn)</span></label>
        {selectedCustomer ? (
          <PickerChip label={`${selectedCustomer.ho_ten} · ${selectedCustomer.sdt}`} onClear={() => { setSelectedCustomer(null); setCustomerId(undefined) }} />
        ) : (
          <button onClick={() => setShowCustomerPicker(true)}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-500 font-medium">
            👤 Chọn hoặc tạo khách hàng
          </button>
        )}
      </div>
      <Field label="CHỦ ĐẦU TƯ *" value={form.chu_dau_tu} onChange={v => set('chu_dau_tu', v)} placeholder="Tên cá nhân / công ty" />
      <SelectField label="LOẠI DỰ ÁN" value={form.loai_da} onChange={v => set('loai_da', v)} options={['', ...LOAI_DU_AN_OPTIONS]} />
      <Field label="QUY MÔ" value={form.quy_mo} onChange={v => set('quy_mo', v)} placeholder="30 phòng + hồ bơi" />
      <Field label="TỈNH / THÀNH" value={form.tinh_thanh} onChange={v => set('tinh_thanh', v)} placeholder="Ninh Thuận" />
      <Field label="GIÁ TRỊ DỰ TOÁN (VNĐ)" value={form.gia_tri_dt} onChange={v => set('gia_tri_dt', v)} placeholder="150000000" type="number" />
      <div>
        <label className="text-sm font-semibold text-gray-600 mb-1 block">TỶ LỆ THẮNG THẦU: {form.ty_le_thang}%</label>
        <input type="range" min="0" max="100" step="5" value={form.ty_le_thang}
          onChange={e => set('ty_le_thang', e.target.value)} className="w-full accent-blue-600" />
        <div className="flex justify-between text-xs text-gray-300 mt-0.5">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>
      <TextArea label="GHI CHÚ" value={form.ghi_chu} onChange={v => set('ghi_chu', v)} placeholder="Tình hình đàm phán, ghi chú thêm..." />
    </BottomSheet>
    </>
  )
}

// ─── Cards ────────────────────────────────────────────────────────────────────

const B2C_DELIVERY_STATUSES = ['Chờ xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Đã giao', 'Đã thanh toán']

function ContractCard({ c, onClick, onStatusClick }: {
  c: Contract; onClick: () => void
  onStatusClick?: (id: string, current: string) => void
}) {
  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left">
      <button onClick={onClick} className="w-full text-left active:opacity-80">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm">{c.khach_hang}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.ma_hd} · {c.sdt}</p>
            {c.san_pham.length > 0 && <p className="text-xs text-gray-500 mt-1 truncate">{c.san_pham.join(', ')}</p>}
          </div>
          <StatusBadge label={c.trang_thai} colors={CONTRACT_STATUS_COLORS} />
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="text-sm font-bold text-green-600">{fmtMoney(c.gia_tri_hd)}</span>
          {c.nguoi_phu_trach && <span className="text-xs text-gray-400">👤 {c.nguoi_phu_trach}</span>}
          <span className="text-xs text-gray-300 ml-auto">Ký: {fmtDate(c.ngay_ky)}</span>
        </div>
        {c.dia_chi_ct && <p className="text-xs text-gray-400 mt-1.5 truncate">📍 {c.dia_chi_ct}</p>}
        {c.ngay_giao_dk && <p className="text-xs text-orange-500 mt-1">📦 Giao dự kiến: {fmtDate(c.ngay_giao_dk)}</p>}
      </button>
      {onStatusClick && (
        <button onClick={e => { e.stopPropagation(); onStatusClick(c.record_id, c.trang_thai) }}
          className="mt-3 w-full text-xs font-semibold text-blue-600 bg-blue-50 py-2 rounded-xl border border-blue-100">
          Cập nhật trạng thái giao
        </button>
      )}
    </div>
  )
}

function CommercialCard({ c, onClick }: { c: CommercialOrder; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">{c.ten_kh}</p>
          <p className="text-xs text-gray-400 mt-0.5">{c.ma_don} · {c.loai_khach}</p>
          <p className="text-xs text-gray-500 mt-1 truncate">{c.san_pham} × {c.so_luong} {c.don_vi}</p>
        </div>
        <StatusBadge label={c.trang_thai} colors={COMMERCIAL_STATUS_COLORS} />
      </div>
      {c.dia_chi && <p className="text-xs text-gray-400 mt-1 truncate">📍 {c.dia_chi}</p>}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <span className="text-sm font-bold text-green-600">{fmtMoney(c.tong_tien)}</span>
        {c.tinh_thanh && <span className="text-xs text-gray-400">{c.tinh_thanh}</span>}
        <span className="text-xs text-gray-300 ml-auto">{fmtDateStr(c.ngay_dat)}</span>
      </div>
    </button>
  )
}

function ProjectCard({ p, onClick }: { p: Project; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{p.ten_da}</p>
          <p className="text-xs text-gray-400 mt-0.5">{p.ma_da} · {p.loai_da}</p>
          <p className="text-xs text-gray-500 mt-1 truncate">{p.chu_dau_tu}</p>
        </div>
        <StatusBadge label={p.giai_doan} colors={PROJECT_STAGE_COLORS} />
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-sm font-bold text-blue-600">
          {p.gia_tri_hd > 0 ? fmtMoney(p.gia_tri_hd) : `DT: ${fmtMoney(p.gia_tri_dt)}`}
        </span>
        {p.ty_le_thang > 0 && (
          <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
            {p.ty_le_thang}% thắng thầu
          </span>
        )}
        {p.tinh_thanh && <span className="text-xs text-gray-400">📍 {p.tinh_thanh}</span>}
      </div>
    </button>
  )
}

// ─── Time filter helpers ──────────────────────────────────────────────────────

type TimePreset = 'month' | 'last_month' | 'quarter' | 'all' | 'custom'

function currentYM() {
  const d = new Date()
  return { y: d.getFullYear(), m: d.getMonth() + 1 }
}

function presetLabel(p: TimePreset, customY: number, customM: number) {
  if (p === 'all')        return 'Tất cả'
  if (p === 'month')      return 'Tháng này'
  if (p === 'last_month') return 'Tháng trước'
  if (p === 'quarter')    return 'Quý này'
  return `${String(customM).padStart(2, '0')}/${customY}`
}

function presetRange(p: TimePreset, customY: number, customM: number): [number, number] | null {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1
  if (p === 'all') return null
  if (p === 'month') return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime() - 1]
  if (p === 'last_month') {
    const lm = m === 1 ? 12 : m - 1, ly = m === 1 ? y - 1 : y
    return [new Date(ly, lm - 1, 1).getTime(), new Date(ly, lm, 1).getTime() - 1]
  }
  if (p === 'quarter') {
    const q = Math.floor((m - 1) / 3)
    return [new Date(y, q * 3, 1).getTime(), new Date(y, q * 3 + 3, 1).getTime() - 1]
  }
  return [new Date(customY, customM - 1, 1).getTime(), new Date(customY, customM, 1).getTime() - 1]
}

// ─── Data hook ────────────────────────────────────────────────────────────────

type Tab = 'b2c' | 'commercial' | 'projects'

function useContractData(tab: Tab) {
  const [data, setData]       = useState<(Contract | CommercialOrder | Project)[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/lark/orders?tab=${tab}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data ?? [])
    } catch {
      setError('Không tải được dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load, setData }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // Đọc ?tab= từ URL để hỗ trợ deep-link (vd: từ dashboard stats)
  const urlTab = searchParams.get('tab') as Tab | null
  const validTabs: Tab[] = ['b2c', 'commercial', 'projects']
  const initTab: Tab = urlTab && validTabs.includes(urlTab) ? urlTab : 'b2c'

  const [tab, setTab]           = useState<Tab>(initTab)
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [deliveryFilter, setDeliveryFilter]           = useState<string>('all')
  const [role, setRole]                               = useState<string>('')
  const [quickStatusId, setQuickStatusId]             = useState<string | null>(null)
  const [quickStatusCurrent, setQuickStatusCurrent]   = useState<string>('')
  const [quickStatusSaving, setQuickStatusSaving]     = useState(false)
  const toast = useToast()

  const { y: cY, m: cM } = currentYM()
  const [timePreset, setTimePreset] = useState<TimePreset>('all')
  const [customY,    setCustomY]    = useState(cY)
  const [customM,    setCustomM]    = useState(cM)
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => { setTimePreset('all'); setShowPicker(false) }, [tab])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setRole(d?.role ?? '')).catch(() => {})
  }, [])

  // from_quote: navigate từ BG detail → tự mở form đúng tab với data pre-filled
  useEffect(() => {
    if (searchParams.get('from_quote')) {
      const targetTab = (searchParams.get('tab') as Tab) ?? 'b2c'
      if (validTabs.includes(targetTab)) setTab(targetTab)
      setShowForm(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hook = useContractData(tab)
  const { data, loading, error, reload } = hook

  const ptr = usePullToRefresh(async () => { reload() })

  const timeRange = presetRange(timePreset, customY, customM)
  const filtered = data.filter(item => {
    const q = search.toLowerCase()
    const textMatch = !q || JSON.stringify(item).toLowerCase().includes(q)
    if (!textMatch) return false
    if (tab === 'b2c' && deliveryFilter !== 'all') {
      if ((item as Contract).trang_thai !== deliveryFilter) return false
    }
    if (timeRange) {
      const dateStr = (item as any).created_at
      if (dateStr) {
        const ms = new Date(dateStr).getTime()
        if (ms < timeRange[0] || ms > timeRange[1]) return false
      }
    }
    return true
  })

  const allTabs: { key: Tab; label: string; icon: string; roles?: string[] }[] = [
    { key: 'b2c',        label: 'Hợp đồng', icon: '📄' },
    { key: 'commercial', label: 'Thương mại', icon: '🏪', roles: ['admin','ceo','director','sales','accountant'] },
    { key: 'projects',   label: 'Dự án',      icon: '🏗️', roles: ['admin','ceo','director','sales','accountant'] },
  ]
  const tabs = role ? allTabs.filter(t => !t.roles || t.roles.includes(role)) : allTabs

  const handleCreated = (item: Contract | CommercialOrder | Project) => {
    hook.setData(prev => [item, ...prev])
    setShowForm(false)
  }

  const getDetailPath = (item: Contract | CommercialOrder | Project) => {
    if (tab === 'b2c')        return `/dashboard/contracts/b2c/${item.record_id}`
    if (tab === 'commercial') return `/dashboard/contracts/commercial/${item.record_id}`
    return `/dashboard/contracts/project/${item.record_id}`
  }

  const handleQuickStatus = async (status: string) => {
    if (!quickStatusId) return
    setQuickStatusSaving(true)
    try {
      const res = await fetch(`/api/lark/orders/contract/${quickStatusId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trang_thai: status }),
      })
      if (!res.ok) throw new Error()
      hook.setData(prev => prev.map(o =>
        o.record_id === quickStatusId ? { ...o, trang_thai: status } as typeof o : o
      ))
      toast('Đã cập nhật trạng thái giao')
      setQuickStatusId(null)
    } catch {
      toast('Lỗi cập nhật trạng thái', true)
    } finally {
      setQuickStatusSaving(false)
    }
  }

  const countLabel =
    tab === 'b2c'        ? `${data.length} hợp đồng` :
    tab === 'commercial' ? `${data.length} đơn thương mại` :
    `${data.length} dự án`

  const searchPlaceholder =
    tab === 'b2c'        ? 'Tìm tên KH, mã HĐ, sản phẩm...'     :
    tab === 'commercial' ? 'Tìm tên đại lý, mã đơn, sản phẩm...' :
    'Tìm tên dự án, chủ đầu tư...'

  // Kiểm tra quyền tạo mới theo tab
  const canCreate =
    tab === 'b2c'        ? ['admin','ceo','sales'].includes(role) :
    tab === 'commercial' ? ['admin','ceo','director','sales'].includes(role) :
    /* projects */         ['admin','ceo','director','sales'].includes(role)

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Hợp đồng</h1>
            <p className="text-xs text-gray-400">{loading ? 'Đang tải...' : countLabel}</p>
          </div>
          {canCreate && (
            <button onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5">
              <span className="text-base leading-none">+</span> Thêm mới
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(t => (
            <button key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); setDeliveryFilter('all') }}
              className={`flex-shrink-0 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={searchPlaceholder} value={search}
            onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">✕</button>
          )}
        </div>

        {/* Time filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 shrink-0">Thời gian:</span>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
            {(['month', 'last_month', 'quarter', 'all'] as TimePreset[]).map(p => (
              <button key={p}
                onClick={() => { setTimePreset(p); setShowPicker(false) }}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  timePreset === p && p !== 'custom'
                    ? 'bg-blue-600 text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >{presetLabel(p, customY, customM)}</button>
            ))}
            <button onClick={() => setShowPicker(v => !v)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                timePreset === 'custom'
                  ? 'bg-blue-600 text-white border-transparent'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >{timePreset === 'custom' ? presetLabel('custom', customY, customM) : 'Tùy chọn'}</button>
          </div>
        </div>
        {showPicker && (
          <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2.5">
            <select value={customM} onChange={e => { setCustomM(Number(e.target.value)); setTimePreset('custom') }}
              className="text-sm bg-white border border-blue-200 rounded-lg px-2 py-1 outline-none">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
            <select value={customY} onChange={e => { setCustomY(Number(e.target.value)); setTimePreset('custom') }}
              className="text-sm bg-white border border-blue-200 rounded-lg px-2 py-1 outline-none">
              {Array.from({ length: 5 }, (_, i) => cY - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => setShowPicker(false)} className="text-blue-600 text-sm font-semibold ml-auto">Xong</button>
          </div>
        )}

        {/* Delivery filter — B2C, logistics only */}
        {tab === 'b2c' && role === 'logistics' && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {['all', ...B2C_DELIVERY_STATUSES].map(s => (
              <button key={s} onClick={() => setDeliveryFilter(s)}
                className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  deliveryFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'
                }`}>
                {s === 'all' ? 'Tất cả' : s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto"
        onTouchStart={ptr.onTouchStart} onTouchMove={ptr.onTouchMove} onTouchEnd={ptr.onTouchEnd}>
        <PullIndicator dist={ptr.dist} refreshing={ptr.refreshing} />
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 text-sm mb-3">{error}</p>
              <button onClick={reload} className="text-blue-600 text-sm font-semibold">Thử lại</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2">
              <span className="text-4xl">{search ? '🔍' : tab === 'b2c' ? '📄' : tab === 'commercial' ? '🏪' : '🏗️'}</span>
              <p className="text-sm font-medium text-gray-500">{search ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu'}</p>
            </div>
          ) : tab === 'b2c' ? (
            (filtered as Contract[]).map(c => (
              <ContractCard key={c.record_id} c={c}
                onClick={() => router.push(getDetailPath(c))}
                onStatusClick={role === 'logistics' ? (id, current) => { setQuickStatusId(id); setQuickStatusCurrent(current) } : undefined}
              />
            ))
          ) : tab === 'commercial' ? (
            (filtered as CommercialOrder[]).map(c => (
              <CommercialCard key={c.record_id} c={c} onClick={() => router.push(getDetailPath(c))} />
            ))
          ) : (
            (filtered as Project[]).map(p => (
              <ProjectCard key={p.record_id} p={p} onClick={() => router.push(getDetailPath(p))} />
            ))
          )}
        </div>
      </div>

      {/* Add forms */}
      {showForm && tab === 'b2c' && (
        <AddContractForm
          onClose={() => setShowForm(false)}
          onCreated={item => handleCreated(item as Contract)}
          fromQuoteRecordId={searchParams.get('from_quote') ?? undefined}
          initialKhachHang= {searchParams.get('khach_hang') ?? undefined}
          initialSdt=       {searchParams.get('sdt')        ?? undefined}
          initialGiaTri=    {searchParams.get('gia_tri')    ?? undefined}
          initialDiaChiCt=  {searchParams.get('dia_chi_ct') ?? undefined}
        />
      )}
      {showForm && tab === 'commercial' && (
        <AddCommercialForm
          onClose={() => setShowForm(false)}
          onCreated={item => handleCreated(item as CommercialOrder)}
          fromQuoteRecordId={searchParams.get('from_quote')   ?? undefined}
          initialTenKh=     {searchParams.get('khach_hang')   ?? undefined}
          initialSdt=       {searchParams.get('sdt')          ?? undefined}
          initialGiaTri=    {searchParams.get('gia_tri')      ?? undefined}
        />
      )}
      {showForm && tab === 'projects' && (
        <AddProjectForm
          onClose={() => setShowForm(false)}
          onCreated={item => handleCreated(item as Project)}
          fromQuoteRecordId={searchParams.get('from_quote')   ?? undefined}
          initialTenDa=     {searchParams.get('ten_da')       ?? undefined}
          initialChuDauTu=  {searchParams.get('chu_dau_tu')   ?? undefined}
          initialGiaTri=    {searchParams.get('gia_tri')      ?? undefined}
        />
      )}

      {/* Quick delivery status sheet — logistics */}
      {quickStatusId && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={e => e.target === e.currentTarget && setQuickStatusId(null)}>
          <div className="bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">Trạng thái giao hàng</h2>
              <button onClick={() => setQuickStatusId(null)} className="text-gray-400 text-lg p-1">✕</button>
            </div>
            <div className="p-4 space-y-2 pb-8">
              {B2C_DELIVERY_STATUSES.map(s => (
                <button key={s} onClick={() => handleQuickStatus(s)} disabled={quickStatusSaving}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left disabled:opacity-50 ${
                    quickStatusCurrent === s ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}>
                  <span className="text-sm font-medium">{s}</span>
                  {quickStatusCurrent === s && <span className="text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
