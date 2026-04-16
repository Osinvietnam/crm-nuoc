'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePullToRefresh, PullIndicator } from '@/components/PullToRefresh'
import {
  CONTRACT_STATUS_COLORS,
  COMMERCIAL_STATUS_COLORS,
  PROJECT_STAGE_COLORS,
  QUOTE_STATUS_COLORS,
  NGUON_KH_OPTIONS,
  LOAI_KHACH_OPTIONS,
  LOAI_DU_AN_OPTIONS,
  PHUONG_THUC_TT_OPTIONS,
} from '@/lib/lark/tables'
import type { Contract, CommercialOrder, Project } from '@/app/api/lark/orders/route'
import type { Quote } from '@/app/api/lark/quotes/_mappers'
import type { Customer } from '@/app/api/lark/customers/route'
import type { Product } from '@/app/api/lark/products/_mapper'
import { useQuoteItems, itemsToLarkFields } from '@/components/QuoteItemsEditor'

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

// ─── Shared form components ───────────────────────────────────────────────────

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
        className={`w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${readOnly ? 'bg-gray-50 text-gray-400' : ''}`} />
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

// ─── Customer Picker ──────────────────────────────────────────────────────────

function CustomerPicker({ onSelect, onClose }: {
  onSelect: (c: Customer) => void
  onClose: () => void
}) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [q, setQ]                 = useState('')

  useEffect(() => {
    fetch('/api/lark/customers')
      .then(r => r.json())
      .then(d => setCustomers(d.customers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = customers.filter(c => {
    if (!q) return true
    const s = (c.ho_ten + c.sdt + c.ma_kh).toLowerCase()
    return s.includes(q.toLowerCase())
  })

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-bold text-gray-800">Chọn khách hàng</h2>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-100">
        <input
          autoFocus
          type="search"
          placeholder="Tìm tên, SĐT, mã KH..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm outline-none focus:border-blue-400"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-12">Không tìm thấy</p>
        )}
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

type PriceKey = 'gia_niem_yet' | 'gia_chiet_khau' | 'gia_dai_ly' | 'gia_npp'

function ProductPicker({ onSelect, onClose, priceLabel }: {
  onSelect: (p: Product) => void
  onClose: () => void
  priceLabel?: string   // tên loại giá sẽ áp dụng để user thấy rõ
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
        <input
          autoFocus
          type="search"
          placeholder="Tìm tên, mã, phân loại..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm outline-none focus:border-blue-400"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-12">Không tìm thấy sản phẩm</p>
        )}
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

// ─── Picker chip (hiển thị item đã chọn) ─────────────────────────────────────

function PickerChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
      <span className="text-xs text-blue-700 font-medium flex-1 truncate">{label}</span>
      <button onClick={onClear} className="text-blue-400 text-base leading-none flex-shrink-0">×</button>
    </div>
  )
}

// Lấy đơn giá phù hợp theo loại khách
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

function AddContractForm({
  onClose,
  onCreated,
  fromQuoteRecordId = '',
  initialKhachHang  = '',
  initialSdt        = '',
  initialGiaTri     = '',
  initialDiaChiCt   = '',
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
    // C3: pre-fill từ URL params khi navigate từ BG detail
    khach_hang: initialKhachHang,
    sdt:        initialSdt,
    san_pham:   '',
    gia_tri_hd: initialGiaTri,
    dia_chi_ct: initialDiaChiCt,
    ghi_chu:    '',
  })
  const [customerRecordId, setCustomerRecordId] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedProduct, setSelectedProduct]   = useState<Product | null>(null)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showProductPicker, setShowProductPicker]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c)
    setCustomerRecordId(c.record_id)
    setForm(f => ({
      ...f,
      khach_hang: c.ho_ten,
      sdt: c.sdt,
      dia_chi_ct: c.dia_chi_ct || c.dia_chi_hd || f.dia_chi_ct,
    }))
    setShowCustomerPicker(false)
  }

  const clearCustomer = () => {
    setSelectedCustomer(null); setCustomerRecordId('')
    setForm(f => ({ ...f, khach_hang: '', sdt: '' }))
  }

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p)
    setForm(f => ({
      ...f,
      san_pham: p.ten_sp,
      gia_tri_hd: f.gia_tri_hd || (p.gia_niem_yet > 0 ? String(p.gia_niem_yet) : ''),
    }))
    setShowProductPicker(false)
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
          gia_tri_hd: Number(form.gia_tri_hd.replace(/\D/g, '')),
          // customer_id (Supabase integer) để link HĐ với KH — bắt buộc cho sync pipeline + commission
          customer_id:        selectedCustomer?.id         || undefined,
          customer_record_id: customerRecordId             || undefined,
          // C3: link ngược BG → HĐ (quote.record_id = String(quotes.id))
          quote_record_id:    fromQuoteRecordId            || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo HĐ'); return }
      onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <>
      {showCustomerPicker && (
        <CustomerPicker onSelect={handleSelectCustomer} onClose={() => setShowCustomerPicker(false)} />
      )}
      {showProductPicker && (
        <ProductPicker onSelect={handleSelectProduct} onClose={() => setShowProductPicker(false)} />
      )}

      <BottomSheet title="Tạo hợp đồng B2C" onClose={onClose} error={error}
        footer={<SheetActions onClose={onClose} onSubmit={submit} saving={saving} />}>
        {/* Customer picker */}
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

        <Field label="TÊN KHÁCH HÀNG *" value={form.khach_hang} onChange={v => set('khach_hang', v)}
          placeholder="Hoặc nhập tay nếu chưa có trong hệ thống" />
        <Field label="SỐ ĐIỆN THOẠI" value={form.sdt} onChange={v => set('sdt', v)} placeholder="0901234567" type="tel" />

        {/* Product picker */}
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">SẢN PHẨM CHÍNH</label>
          {selectedProduct ? (
            <PickerChip
              label={`${selectedProduct.ten_sp} · ${fmtMoney(selectedProduct.gia_niem_yet)}`}
              onClear={() => { setSelectedProduct(null); set('san_pham', '') }}
            />
          ) : (
            <button onClick={() => setShowProductPicker(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 font-medium">
              + Chọn từ danh mục sản phẩm
            </button>
          )}
        </div>

        <Field label="GIÁ TRỊ HĐ (VNĐ) *" value={form.gia_tri_hd} onChange={v => set('gia_tri_hd', v)}
          placeholder="65000000" type="number" />
        <Field label="ĐỊA CHỈ CÔNG TRÌNH" value={form.dia_chi_ct} onChange={v => set('dia_chi_ct', v)}
          placeholder="Số nhà, đường, quận..." />
        <TextArea label="GHI CHÚ" value={form.ghi_chu} onChange={v => set('ghi_chu', v)} placeholder="Ghi chú thêm..." />
      </BottomSheet>
    </>
  )
}

function AddCommercialForm({ onClose, onCreated }: { onClose: () => void; onCreated: (c: CommercialOrder) => void }) {
  const [form, setForm] = useState({
    ten_kh: '', sdt: '', san_pham: '', so_luong: '', don_gia: '',
    loai_khach: 'Đại lý cấp 1', tinh_thanh: '', phuong_thuc_tt: 'Chuyển khoản', ghi_chu: '',
  })
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p)
    const price = priceForLoaiKhach(p, form.loai_khach)
    setForm(f => ({
      ...f,
      san_pham: p.ten_sp,
      don_gia: price > 0 ? String(price) : f.don_gia,
    }))
    setShowProductPicker(false)
  }

  // Re-price khi loai_khach thay đổi
  const handleLoaiKhach = (v: string) => {
    set('loai_khach', v)
    if (selectedProduct) {
      const price = priceForLoaiKhach(selectedProduct, v)
      if (price > 0) set('don_gia', String(price))
    }
  }

  const tong = form.so_luong && form.don_gia
    ? (Number(form.so_luong) * Number(form.don_gia)).toLocaleString('vi-VN') + '₫'
    : ''

  const submit = async () => {
    if (!form.ten_kh || !form.san_pham || !form.so_luong || !form.don_gia) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc'); return
    }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/lark/orders?tab=commercial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, so_luong: Number(form.so_luong), don_gia: Number(form.don_gia) }),
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
        <ProductPicker
          onSelect={handleSelectProduct}
          onClose={() => setShowProductPicker(false)}
          priceLabel={priceKeyLabel(form.loai_khach)}
        />
      )}

      <BottomSheet title="Tạo đơn thương mại" onClose={onClose} error={error}
        footer={<SheetActions onClose={onClose} onSubmit={submit} saving={saving} />}>
        <SelectField label="LOẠI KHÁCH" value={form.loai_khach} onChange={handleLoaiKhach}
          options={[...LOAI_KHACH_OPTIONS]} />
        <Field label="TÊN KHÁCH HÀNG / ĐẠI LÝ *" value={form.ten_kh} onChange={v => set('ten_kh', v)}
          placeholder="Cửa hàng Minh Đức" />
        <Field label="SỐ ĐIỆN THOẠI" value={form.sdt} onChange={v => set('sdt', v)} placeholder="0901234567" type="tel" />
        <Field label="TỈNH / THÀNH PHỐ" value={form.tinh_thanh} onChange={v => set('tinh_thanh', v)} placeholder="Hà Nội" />

        {/* Product picker */}
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">SẢN PHẨM / VẬT TƯ *</label>
          {selectedProduct ? (
            <PickerChip
              label={`${selectedProduct.ten_sp} · ${priceKeyLabel(form.loai_khach)}: ${fmtMoney(priceForLoaiKhach(selectedProduct, form.loai_khach))}`}
              onClear={() => { setSelectedProduct(null); set('san_pham', ''); set('don_gia', '') }}
            />
          ) : (
            <button onClick={() => setShowProductPicker(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 font-medium mb-1">
              + Chọn từ danh mục sản phẩm
            </button>
          )}
          {/* Vẫn cho nhập tay nếu cần */}
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
        {tong && (
          <div className="bg-green-50 rounded-xl px-4 py-2.5">
            <p className="text-sm font-bold text-green-700">Tổng tiền: {tong}</p>
          </div>
        )}
        <SelectField label="PHƯƠNG THỨC THANH TOÁN" value={form.phuong_thuc_tt}
          onChange={v => set('phuong_thuc_tt', v)} options={[...PHUONG_THUC_TT_OPTIONS]} />
        <TextArea label="GHI CHÚ" value={form.ghi_chu} onChange={v => set('ghi_chu', v)} placeholder="Ghi chú thêm..." />
      </BottomSheet>
    </>
  )
}

function AddProjectForm({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [form, setForm] = useState({
    ten_da: '', chu_dau_tu: '', loai_da: '', quy_mo: '',
    tinh_thanh: '', gia_tri_dt: '', ty_le_thang: '50', ghi_chu: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.ten_da || !form.chu_dau_tu) { setError('Tên dự án và chủ đầu tư là bắt buộc'); return }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/lark/orders?tab=projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, gia_tri_dt: Number(form.gia_tri_dt), ty_le_thang: Number(form.ty_le_thang) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo dự án'); return }
      onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <BottomSheet title="Tạo dự án B2B" onClose={onClose} error={error}
      footer={<SheetActions onClose={onClose} onSubmit={submit} saving={saving} />}>
      <Field label="TÊN DỰ ÁN *" value={form.ten_da} onChange={v => set('ten_da', v)} placeholder="Hệ thống lọc nước Resort..." />
      <Field label="CHỦ ĐẦU TƯ *" value={form.chu_dau_tu} onChange={v => set('chu_dau_tu', v)} placeholder="Tên cá nhân / công ty" />
      <SelectField label="LOẠI DỰ ÁN" value={form.loai_da} onChange={v => set('loai_da', v)} options={['', ...LOAI_DU_AN_OPTIONS]} />
      <Field label="QUY MÔ" value={form.quy_mo} onChange={v => set('quy_mo', v)} placeholder="30 phòng + hồ bơi" />
      <Field label="TỈNH / THÀNH" value={form.tinh_thanh} onChange={v => set('tinh_thanh', v)} placeholder="Ninh Thuận" />
      <Field label="GIÁ TRỊ DỰ TOÁN (VNĐ)" value={form.gia_tri_dt} onChange={v => set('gia_tri_dt', v)} placeholder="150000000" type="number" />
      <div>
        <label className="text-sm font-semibold text-gray-600 mb-1 block">TỶ LỆ THẮNG THẦU: {form.ty_le_thang}%</label>
        <input type="range" min="0" max="100" step="5" value={form.ty_le_thang}
          onChange={e => set('ty_le_thang', e.target.value)}
          className="w-full accent-blue-600" />
        <div className="flex justify-between text-xs text-gray-300 mt-0.5">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>
      <TextArea label="GHI CHÚ" value={form.ghi_chu} onChange={v => set('ghi_chu', v)} placeholder="Tình hình đàm phán, ghi chú thêm..." />
    </BottomSheet>
  )
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function ContractCard({ c, onClick }: { c: Contract; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform">
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
    </button>
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
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-sm font-bold text-green-600">{fmtMoney(c.tong_tien)}</span>
        {c.tinh_thanh && <span className="text-xs text-gray-400">📍 {c.tinh_thanh}</span>}
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

// ─── Follow-up Reminder Banner ───────────────────────────────────────────────

function isDueForFollowUp(q: Quote): boolean {
  if (!q.ngay_follow_up) return false
  if (['Chấp nhận', 'Từ chối'].includes(q.trang_thai)) return false
  // Tính đến cuối ngày hôm nay
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
  return q.ngay_follow_up <= endOfToday.getTime()
}

function FollowUpBanner({ quotes, onClickQuote }: {
  quotes: Quote[]
  onClickQuote: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const due = quotes.filter(isDueForFollowUp)
  if (due.length === 0) return null

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-2xl overflow-hidden mb-1">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-orange-100">
        <div className="flex items-center gap-2">
          <span>⏰</span>
          <span className="text-sm font-bold text-orange-700">Cần follow-up hôm nay</span>
          <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {due.length}
          </span>
        </div>
        <span className="text-orange-400 text-xs font-medium">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-orange-100 divide-y divide-orange-100">
          {due.map(q => {
            const isOverdue = q.ngay_follow_up! < startOfToday.getTime()
            const daysLate  = isOverdue
              ? Math.floor((startOfToday.getTime() - q.ngay_follow_up!) / 86400000)
              : 0
            return (
              <button key={q.record_id} onClick={() => onClickQuote(q.record_id)}
                className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 active:bg-orange-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{q.khach_hang}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {q.ma_bao_gia}
                    {q.nguoi_phu_trach ? ` · ${q.nguoi_phu_trach}` : ''}
                  </p>
                  {q.ket_qua_follow_up && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">💬 {q.ket_qua_follow_up}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-orange-500'}`}>
                  {isOverdue ? `Trễ ${daysLate}n` : 'Hôm nay'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Quote Card ───────────────────────────────────────────────────────────────

function QuoteCard({ q, onClick }: { q: Quote; onClick: () => void }) {
  const now = Date.now()
  const isExpired = q.ngay_het_han && now > q.ngay_het_han && q.trang_thai !== 'Chấp nhận' && q.trang_thai !== 'Từ chối'
  const displayStatus = isExpired ? 'Hết hạn' : q.trang_thai
  return (
    <button onClick={onClick} className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{q.khach_hang}</p>
          <p className="text-xs text-gray-400 mt-0.5">{q.ma_bao_gia} · v{q.phien_ban}</p>
          {q.san_pham.length > 0 && (
            <p className="text-xs text-gray-500 mt-1 truncate">{q.san_pham.join(', ')}</p>
          )}
        </div>
        <StatusBadge label={displayStatus} colors={QUOTE_STATUS_COLORS} />
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-sm font-bold text-blue-600">{fmtMoney(q.gia_tri_sau_ck || q.tong_gia_tri)}</span>
        {q.chiet_khau > 0 && (
          <span className="text-xs text-orange-500 font-medium">-{q.chiet_khau}%</span>
        )}
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

// ─── Add Quote Form ───────────────────────────────────────────────────────────

function AddQuoteForm({ onClose, onCreated, prefilledCustomer }: {
  onClose: () => void
  onCreated: (q: Quote) => void
  prefilledCustomer?: Customer
}) {
  const DRAFT_KEY = 'quote_draft_orders'
  const { items, total, addItem, addBlank, removeItem, changeItem, clear } = useQuoteItems(DRAFT_KEY)

  const [form, setForm] = useState({
    khach_hang:         prefilledCustomer?.ho_ten ?? '',
    sdt:                prefilledCustomer?.sdt    ?? '',
    chiet_khau:         '0',
    ghi_chu_ky_thuat:   '',
    ghi_chu_thuong_mai: '',
    kenh_tiep_nhan:     '',
    ngay_gui_kh:        '',   // YYYY-MM-DD string
  })
  const [customerRecordId,    setCustomerRecordId]    = useState(prefilledCustomer?.record_id ?? '')
  const [selectedCustomer,    setSelectedCustomer]    = useState<Customer | null>(prefilledCustomer ?? null)
  const [showCustomerPicker,  setShowCustomerPicker]  = useState(false)
  const [showProductPicker,   setShowProductPicker]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const ck      = Number(form.chiet_khau) || 0
  const afterCK = Math.round(total * (1 - ck / 100))

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c); setCustomerRecordId(c.record_id)
    setForm(f => ({ ...f, khach_hang: c.ho_ten, sdt: c.sdt }))
    setShowCustomerPicker(false)
  }
  const clearCustomer = () => {
    setSelectedCustomer(null); setCustomerRecordId('')
    setForm(f => ({ ...f, khach_hang: '', sdt: '' }))
  }

  const handleSelectProduct = (p: Product) => {
    addItem({ ten_sp: p.ten_sp, don_gia: p.gia_chiet_khau || p.gia_niem_yet || 0 })
    setShowProductPicker(false)
  }

  const submit = async () => {
    if (!form.khach_hang) { setError('Tên khách hàng là bắt buộc'); return }
    if (items.length === 0) { setError('Vui lòng thêm ít nhất 1 sản phẩm'); return }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const { san_pham } = itemsToLarkFields(items)
      const res = await fetch('/api/lark/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          khach_hang:         form.khach_hang,
          sdt:                form.sdt,
          chiet_khau:         ck,
          ghi_chu_ky_thuat:   form.ghi_chu_ky_thuat,
          ghi_chu_thuong_mai: form.ghi_chu_thuong_mai,
          kenh_tiep_nhan:     form.kenh_tiep_nhan   || undefined,
          ngay_gui_kh:        form.ngay_gui_kh ? new Date(form.ngay_gui_kh).getTime() : undefined,
          san_pham,
          tong_gia_tri:       total,
          customer_record_id: customerRecordId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo báo giá'); return }
      clear()
      onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '0₫'

  return (
    <>
      {showCustomerPicker && (
        <CustomerPicker onSelect={handleSelectCustomer} onClose={() => setShowCustomerPicker(false)} />
      )}
      {showProductPicker && (
        <ProductPicker onSelect={handleSelectProduct} onClose={() => setShowProductPicker(false)} />
      )}

      <BottomSheet title="Tạo báo giá" onClose={onClose} error={error}
        footer={<SheetActions onClose={onClose} onSubmit={submit} saving={saving} />}>

        {/* Customer */}
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
        {!selectedCustomer && (
          <Field label="TÊN KHÁCH HÀNG *" value={form.khach_hang} onChange={v => set('khach_hang', v)}
            placeholder="Hoặc nhập tay nếu chưa có trong hệ thống" />
        )}
        <Field label="SỐ ĐIỆN THOẠI" value={form.sdt} onChange={v => set('sdt', v)}
          placeholder="0901234567" type="tel" />

        <SelectField label="NGUỒN KH"
          value={form.kenh_tiep_nhan} onChange={v => set('kenh_tiep_nhan', v)}
          options={['', ...NGUON_KH_OPTIONS]} />

        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">NGÀY GỬI KH</label>
          <input type="date" value={form.ngay_gui_kh} onChange={e => set('ngay_gui_kh', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500">SẢN PHẨM ĐỀ XUẤT</label>
            {items.length > 0 && (
              <button onClick={clear} className="text-xs text-red-400 font-medium">Xoá tất cả</button>
            )}
          </div>

          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={item.ten_sp} onChange={e => changeItem(item.id, 'ten_sp', e.target.value)}
                    placeholder="Tên sản phẩm"
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button onClick={() => removeItem(item.id)}
                    className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
                    <button onClick={() => changeItem(item.id, 'so_luong', Math.max(1, item.so_luong - 1))}
                      className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-md hover:bg-gray-100">−</button>
                    <span className="text-sm font-semibold text-gray-700 w-6 text-center">{item.so_luong}</span>
                    <button onClick={() => changeItem(item.id, 'so_luong', item.so_luong + 1)}
                      className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-md hover:bg-gray-100">+</button>
                  </div>
                  <span className="text-gray-300 text-sm">×</span>
                  <input type="number" value={item.don_gia || ''}
                    onChange={e => changeItem(item.id, 'don_gia', Number(e.target.value) || 0)}
                    placeholder="Đơn giá"
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <span className="text-xs font-semibold text-blue-600 flex-shrink-0 min-w-[72px] text-right">
                    {fmtMoney(item.so_luong * item.don_gia)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowProductPicker(true)}
              className="flex-1 border-2 border-dashed border-blue-200 rounded-xl py-2.5 text-xs text-blue-600 font-semibold">
              + Chọn từ danh mục
            </button>
            <button onClick={addBlank}
              className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-xs text-gray-500 font-semibold">
              + Nhập thủ công
            </button>
          </div>

          {items.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
              <span className="text-xs text-gray-400">{items.length} sản phẩm</span>
              <span className="text-sm font-bold text-gray-800">{fmtMoney(total)}</span>
            </div>
          )}
        </div>

        {/* Discount */}
        <Field label="CHIẾT KHẤU TỔNG (%)" value={form.chiet_khau}
          onChange={v => set('chiet_khau', v)} placeholder="0" type="number" />

        {total > 0 && ck > 0 && (
          <div className="bg-green-50 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-xs text-gray-500">Giá sau chiết khấu</span>
            <span className="text-sm font-bold text-green-600">{fmtMoney(afterCK)}</span>
          </div>
        )}

        <TextArea label="GHI CHÚ KỸ THUẬT" value={form.ghi_chu_ky_thuat}
          onChange={v => set('ghi_chu_ky_thuat', v)} placeholder="Thông số, yêu cầu lắp đặt..." />
        <TextArea label="GHI CHÚ THƯƠNG MẠI" value={form.ghi_chu_thuong_mai}
          onChange={v => set('ghi_chu_thuong_mai', v)} placeholder="Điều kiện thanh toán, giao hàng..." />
      </BottomSheet>
    </>
  )
}

// ─── Data hook ────────────────────────────────────────────────────────────────

type Tab = 'quotes' | 'b2c' | 'commercial' | 'projects'

function useOrderData(tab: Exclude<Tab, 'quotes'>) {
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

function useQuoteData() {
  const [data, setData]       = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/lark/quotes')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data ?? [])
    } catch {
      setError('Không tải được dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load, setData }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab]           = useState<Tab>('quotes')
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)

  // C3: Nếu navigate từ BG detail → tự mở form tạo HĐ B2C
  useEffect(() => {
    if (searchParams.get('from_quote')) {
      setTab('b2c')
      setShowForm(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Quotes tab có hook riêng; các tab còn lại dùng chung
  const orderTab = tab !== 'quotes' ? tab : 'b2c'
  const orderHook  = useOrderData(orderTab as Exclude<Tab, 'quotes'>)
  const quotesHook = useQuoteData()

  const activeHook = tab === 'quotes' ? quotesHook : orderHook
  const { data, loading, error, reload, setData } = activeHook

  const ptr = usePullToRefresh(async () => { reload() })

  const filtered = data.filter(item => {
    const q = search.toLowerCase()
    if (!q) return true
    return JSON.stringify(item).toLowerCase().includes(q)
  })

  const followUpCount = quotesHook.data.filter(isDueForFollowUp).length

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'quotes',     label: 'Báo giá', icon: '📋' },
    { key: 'b2c',        label: 'B2C',     icon: '🏠' },
    { key: 'commercial', label: 'Đại lý',  icon: '🏪' },
    { key: 'projects',   label: 'Dự án',   icon: '🏗️' },
  ]

  const handleCreated = (item: Quote | Contract | CommercialOrder | Project) => {
    if (tab === 'quotes') {
      quotesHook.setData(prev => [item as Quote, ...prev])
    } else {
      orderHook.setData(prev => [item as Contract | CommercialOrder | Project, ...prev])
    }
    setShowForm(false)
  }

  const getOrderDetailPath = (item: Contract | CommercialOrder | Project) => {
    if (tab === 'b2c')        return `/dashboard/orders/contract/${item.record_id}`
    if (tab === 'commercial') return `/dashboard/orders/commercial/${item.record_id}`
    return `/dashboard/orders/project/${item.record_id}`
  }

  const searchPlaceholder =
    tab === 'quotes'     ? 'Tìm tên KH, mã BG, sản phẩm...'    :
    tab === 'b2c'        ? 'Tìm tên KH, mã HĐ, sản phẩm...'    :
    tab === 'commercial' ? 'Tìm tên đại lý, mã đơn, sản phẩm...' :
    'Tìm tên dự án, chủ đầu tư...'

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Đơn hàng</h1>
            <p className="text-xs text-gray-400">
              {loading ? 'Đang tải...' : `${data.length} ${tab === 'quotes' ? 'báo giá' : 'đơn'}`}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
          >
            <span className="text-base leading-none">+</span> Thêm mới
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch('') }}
              className={`flex-shrink-0 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                tab === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.key === 'quotes' && followUpCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {followUpCount > 9 ? '9+' : followUpCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">✕</button>
          )}
        </div>
      </div>

      {/* List */}
      <div
        className="flex-1 overflow-y-auto"
        onTouchStart={ptr.onTouchStart}
        onTouchMove={ptr.onTouchMove}
        onTouchEnd={ptr.onTouchEnd}
      >
        <PullIndicator dist={ptr.dist} refreshing={ptr.refreshing} />
        <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm mb-3">{error}</p>
            <button onClick={reload} className="text-blue-600 text-sm font-semibold">Thử lại</button>
          </div>
        ) : tab === 'quotes' && filtered.length === 0 ? (
          <>
            {!search && (
              <FollowUpBanner
                quotes={quotesHook.data}
                onClickQuote={id => router.push(`/dashboard/orders/quote/${id}`)}
              />
            )}
            <div className="flex flex-col items-center py-10 gap-2">
              <span className="text-4xl">{search ? '🔍' : '📄'}</span>
              <p className="text-sm font-medium text-gray-500">{search ? 'Không tìm thấy kết quả' : 'Chưa có báo giá nào'}</p>
            </div>
          </>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2">
            <span className="text-4xl">{search ? '🔍' : '📦'}</span>
            <p className="text-sm font-medium text-gray-500">{search ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu'}</p>
          </div>
        ) : tab === 'quotes' ? (
          <>
            {!search && (
              <FollowUpBanner
                quotes={quotesHook.data}
                onClickQuote={id => router.push(`/dashboard/orders/quote/${id}`)}
              />
            )}
            {(filtered as Quote[]).map(q => (
              <QuoteCard key={q.record_id} q={q}
                onClick={() => router.push(`/dashboard/orders/quote/${q.record_id}`)} />
            ))}
          </>
        ) : tab === 'b2c' ? (
          (filtered as Contract[]).map(c => (
            <ContractCard key={c.record_id} c={c} onClick={() => router.push(getOrderDetailPath(c))} />
          ))
        ) : tab === 'commercial' ? (
          (filtered as CommercialOrder[]).map(c => (
            <CommercialCard key={c.record_id} c={c} onClick={() => router.push(getOrderDetailPath(c))} />
          ))
        ) : (
          (filtered as Project[]).map(p => (
            <ProjectCard key={p.record_id} p={p} onClick={() => router.push(getOrderDetailPath(p))} />
          ))
        )}
        </div>
      </div>

      {/* Add forms */}
      {showForm && tab === 'quotes' && (
        <AddQuoteForm onClose={() => setShowForm(false)} onCreated={q => handleCreated(q)} />
      )}
      {showForm && tab === 'b2c' && (
        <AddContractForm
          onClose={() => setShowForm(false)}
          onCreated={item => handleCreated(item as Contract)}
          fromQuoteRecordId={searchParams.get('from_quote')  ?? undefined}
          initialKhachHang= {searchParams.get('khach_hang')  ?? undefined}
          initialSdt=       {searchParams.get('sdt')         ?? undefined}
          initialGiaTri=    {searchParams.get('gia_tri')     ?? undefined}
          initialDiaChiCt=  {searchParams.get('dia_chi_ct')  ?? undefined}
        />
      )}
      {showForm && tab === 'commercial' && (
        <AddCommercialForm onClose={() => setShowForm(false)} onCreated={item => handleCreated(item as CommercialOrder)} />
      )}
      {showForm && tab === 'projects' && (
        <AddProjectForm onClose={() => setShowForm(false)} onCreated={item => handleCreated(item as Project)} />
      )}
    </div>
  )
}
