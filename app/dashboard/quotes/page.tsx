'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { QUOTE_STATUS_COLORS, NGUON_KH_OPTIONS } from '@/lib/lark/tables'
import type { Quote } from '@/app/api/lark/quotes/_mappers'
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

function StatusBadge({ label }: { label: string }) {
  const c = QUOTE_STATUS_COLORS[label] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${c.bg} ${c.text}`}>
      {label}
    </span>
  )
}

// ─── Quote card ───────────────────────────────────────────────────────────────

function QuoteCard({ q, onClick }: { q: Quote; onClick: () => void }) {
  const now         = Date.now()
  const isExpired   = q.ngay_het_han && now > q.ngay_het_han
    && !['Chấp nhận', 'Từ chối'].includes(q.trang_thai)
  const displayStatus = isExpired ? 'Hết hạn' : q.trang_thai
  const isPending   = q.trang_thai === 'Chờ duyệt'
  const daysLeft    = q.ngay_het_han ? Math.ceil((q.ngay_het_han - now) / 86400000) : null
  const isSoonExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 3
    && !['Chấp nhận', 'Từ chối'].includes(q.trang_thai)

  return (
    <button
      onClick={onClick}
      className={`w-full bg-white rounded-2xl shadow-sm border p-4 text-left active:scale-[0.98] transition-transform ${
        isPending ? 'border-amber-300 bg-amber-50' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{q.khach_hang}</p>
          <p className="text-xs text-gray-400 mt-0.5">{q.ma_bao_gia} · v{q.phien_ban}</p>
          {isPending && (
            <p className="text-xs text-amber-700 font-semibold mt-0.5">⏳ Chờ CEO/Manager duyệt</p>
          )}
          {isSoonExpiring && (
            <p className="text-xs text-orange-500 font-semibold mt-0.5">⚠️ Còn {daysLeft} ngày hết hạn</p>
          )}
          {q.san_pham.length > 0 && (
            <p className="text-xs text-gray-500 mt-1 truncate">{q.san_pham.join(', ')}</p>
          )}
        </div>
        <StatusBadge label={displayStatus} />
      </div>

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-sm font-bold text-blue-600">
          {fmtMoney(q.gia_tri_sau_ck || q.tong_gia_tri)}
        </span>
        {q.chiet_khau > 0 && (
          <span className="text-xs text-orange-500 font-medium">-{q.chiet_khau}%</span>
        )}
        {q.nguoi_phu_trach && (
          <span className="text-xs text-gray-400">👤 {q.nguoi_phu_trach}</span>
        )}
        {q.ngay_het_han && (
          <span className={`text-xs ml-auto ${isExpired ? 'text-red-400' : 'text-gray-300'}`}>
            HH: {fmtDate(q.ngay_het_han)}
          </span>
        )}
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

function CustomerPicker({ onSelect, onClose }: {
  onSelect: (c: Customer) => void
  onClose:  () => void
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

  const filtered = customers.filter(c =>
    !q || (c.ho_ten + c.sdt + c.ma_kh).toLowerCase().includes(q.toLowerCase())
  )

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

function ProductPicker({ onSelect, onClose }: {
  onSelect: (p: Product) => void
  onClose:  () => void
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

  const filtered = products.filter(p =>
    !q || (p.ten_sp + p.ma_sp + p.phan_loai + p.nhom_sp).toLowerCase().includes(q.toLowerCase())
  )

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

// ─── Add Quote Form ───────────────────────────────────────────────────────────

function AddQuoteForm({
  onClose,
  onCreated,
  prefilledCustomer,
}: {
  onClose:           () => void
  onCreated:         (q: Quote) => void
  prefilledCustomer?: Customer
}) {
  const DRAFT_KEY = 'quote_draft_quotes_page'
  const { items, total, addItem, addBlank, removeItem, changeItem, clear } = useQuoteItems(DRAFT_KEY)

  const [form, setForm] = useState({
    khach_hang:         prefilledCustomer?.ho_ten ?? '',
    sdt:                prefilledCustomer?.sdt    ?? '',
    chiet_khau:         '0',
    ghi_chu_ky_thuat:   '',
    ghi_chu_thuong_mai: '',
    kenh_tiep_nhan:     '',
    ngay_gui_kh:        '',
  })
  const [customerRecordId,   setCustomerRecordId]   = useState(prefilledCustomer?.record_id ?? '')
  const [selectedCustomer,   setSelectedCustomer]   = useState<Customer | null>(prefilledCustomer ?? null)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showProductPicker,  setShowProductPicker]  = useState(false)
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

  const submit = async () => {
    if (!form.khach_hang) { setError('Tên khách hàng là bắt buộc'); return }
    if (items.length === 0) { setError('Vui lòng thêm ít nhất 1 sản phẩm'); return }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const { san_pham } = itemsToLarkFields(items)
      const res = await fetch('/api/lark/quotes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          khach_hang:         form.khach_hang,
          sdt:                form.sdt,
          chiet_khau:         ck,
          ghi_chu_ky_thuat:   form.ghi_chu_ky_thuat   || undefined,
          ghi_chu_thuong_mai: form.ghi_chu_thuong_mai || undefined,
          kenh_tiep_nhan:     form.kenh_tiep_nhan     || undefined,
          ngay_gui_kh:        form.ngay_gui_kh ? new Date(form.ngay_gui_kh).getTime() : undefined,
          san_pham,
          tong_gia_tri:       total,
          customer_record_id: customerRecordId || undefined,
          items: items.map(i => ({
            ten_sp:     i.ten_sp,
            don_gia:    i.don_gia,
            so_luong:   i.so_luong,
            product_id: i.product_id ?? null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo báo giá'); return }
      clear()
      onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  const fmtM = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '0₫'

  return (
    <>
      {showCustomerPicker && (
        <CustomerPicker onSelect={handleSelectCustomer} onClose={() => setShowCustomerPicker(false)} />
      )}
      {showProductPicker && (
        <ProductPicker
          onSelect={p => {
            addItem({ ten_sp: p.ten_sp, don_gia: p.gia_chiet_khau || p.gia_niem_yet || 0, product_id: parseInt(p.record_id) || null })
            setShowProductPicker(false)
          }}
          onClose={() => setShowProductPicker(false)}
        />
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
        <SelectField label="NGUỒN KH" value={form.kenh_tiep_nhan}
          onChange={v => set('kenh_tiep_nhan', v)} options={['', ...NGUON_KH_OPTIONS]} />
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
                    {fmtM(item.so_luong * item.don_gia)}
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
              <span className="text-sm font-bold text-gray-800">{fmtM(total)}</span>
            </div>
          )}
        </div>

        <Field label="CHIẾT KHẤU TỔNG (%)" value={form.chiet_khau}
          onChange={v => set('chiet_khau', v)} placeholder="0" type="number" />
        {total > 0 && ck > 0 && (
          <div className="bg-green-50 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-xs text-gray-500">Giá sau chiết khấu</span>
            <span className="text-sm font-bold text-green-600">{fmtM(afterCK)}</span>
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

// ─── Filter pills ─────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'Chờ duyệt', 'Nháp', 'Đã gửi', 'Đàm phán', 'Chấp nhận', 'Từ chối', 'Hết hạn']

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const router = useRouter()
  const { data, setData, loading, error, reload, loadMore, hasMore, total } = useQuoteData()

  const [myRole,       setMyRole]       = useState('')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm,     setShowForm]     = useState(false)

  const ptr = usePullToRefresh(async () => { reload() })

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setMyRole(d?.role ?? '')).catch(() => {})
  }, [])

  const canCreate = ['admin', 'ceo', 'director', 'sales'].includes(myRole)

  // Client-side filter
  const filtered = useCallback(() => {
    const now = Date.now()
    return data.filter(q => {
      // Text search
      if (search) {
        const s = search.toLowerCase()
        const match = (q.ma_bao_gia + q.khach_hang + q.san_pham.join(' ')).toLowerCase()
        if (!match.includes(s)) return false
      }
      // Status filter
      if (statusFilter !== 'all') {
        const isExpired = q.ngay_het_han && now > q.ngay_het_han
          && !['Chấp nhận', 'Từ chối'].includes(q.trang_thai)
        const displayStatus = isExpired ? 'Hết hạn' : q.trang_thai
        if (displayStatus !== statusFilter) return false
      }
      return true
    })
  }, [data, search, statusFilter])

  const items = filtered()
  const followUpCount = data.filter(isDueForFollowUp).length

  // Count per status for badge display
  const now = Date.now()
  const countByStatus: Record<string, number> = {}
  data.forEach(q => {
    const isExpired = q.ngay_het_han && now > q.ngay_het_han
      && !['Chấp nhận', 'Từ chối'].includes(q.trang_thai)
    const s = isExpired ? 'Hết hạn' : q.trang_thai
    countByStatus[s] = (countByStatus[s] ?? 0) + 1
  })

  const handleCreated = (q: Quote) => {
    setData(prev => [q, ...prev])
    setShowForm(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Báo giá</h1>
            <p className="text-xs text-gray-400">
              {loading ? 'Đang tải...' : `${total} báo giá`}
              {followUpCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {followUpCount} follow-up
                </span>
              )}
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span> Tạo BG
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tìm tên KH, mã BG, sản phẩm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">✕</button>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {STATUS_FILTERS.map(s => {
            const count = s === 'all' ? data.length : (countByStatus[s] ?? 0)
            const isActive = statusFilter === s
            const isPending = s === 'Chờ duyệt' && (countByStatus['Chờ duyệt'] ?? 0) > 0 && !isActive
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : isPending
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                <span>{s === 'all' ? 'Tất cả' : s}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1 rounded-full ${
                    isActive ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>{count}</span>
                )}
              </button>
            )
          })}
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
              {/* Follow-up banner — chỉ hiện khi không đang search/filter */}
              {!search && statusFilter === 'all' && (
                <QuoteFollowUpBanner
                  quotes={data}
                  onClickQuote={id => router.push(`/dashboard/quotes/${id}`)}
                />
              )}

              {items.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <span className="text-4xl">{search || statusFilter !== 'all' ? '🔍' : '📋'}</span>
                  <p className="text-sm font-medium text-gray-500">
                    {search || statusFilter !== 'all' ? 'Không tìm thấy kết quả' : 'Chưa có báo giá nào'}
                  </p>
                  {canCreate && !search && statusFilter === 'all' && (
                    <button onClick={() => setShowForm(true)}
                      className="mt-2 text-sm text-blue-600 font-semibold bg-blue-50 px-4 py-2 rounded-xl">
                      + Tạo báo giá đầu tiên
                    </button>
                  )}
                </div>
              ) : (
                items.map(q => (
                  <QuoteCard key={q.record_id} q={q}
                    onClick={() => router.push(`/dashboard/quotes/${q.record_id}`)} />
                ))
              )}

              {/* Load more */}
              {hasMore && !search && statusFilter === 'all' && (
                <button onClick={loadMore}
                  className="w-full py-3 text-sm text-blue-600 font-semibold text-center border border-blue-100 rounded-2xl bg-blue-50 active:bg-blue-100">
                  Tải thêm ({total - data.length} còn lại)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <AddQuoteForm onClose={() => setShowForm(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
