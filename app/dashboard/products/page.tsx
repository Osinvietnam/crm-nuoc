export const dynamic = 'force-dynamic'
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import type { Product } from '@/app/api/lark/products/_mapper'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  n > 0 ? n.toLocaleString('vi-VN') + '₫' : '—'

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-gray-600 tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 bg-gray-50"
      />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-gray-600 tracking-wide">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 bg-gray-50 resize-none"
      />
    </div>
  )
}

function BottomSheet({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-800">{title}</h2>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 pb-8">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Add Product Form ──────────────────────────────────────────────────────────

type ProductForm = {
  ten_sp: string; ma_sp: string; phan_loai: string; nhom_sp: string
  gia_niem_yet: string; gia_chiet_khau: string; gia_dai_ly: string; gia_npp: string
  hh_kd: string; mo_ta: string
}

const emptyForm: ProductForm = {
  ten_sp: '', ma_sp: '', phan_loai: '', nhom_sp: '',
  gia_niem_yet: '', gia_chiet_khau: '', gia_dai_ly: '', gia_npp: '',
  hh_kd: '', mo_ta: '',
}

function AddProductForm({ onClose, onCreated }: {
  onClose: () => void; onCreated: (p: Product) => void
}) {
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof ProductForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.ten_sp) { setError('Tên sản phẩm là bắt buộc'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/lark/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ten_sp: form.ten_sp,
          ma_sp: form.ma_sp,
          phan_loai: form.phan_loai,
          nhom_sp: form.nhom_sp,
          gia_niem_yet:   Number(form.gia_niem_yet.replace(/\D/g, '')) || 0,
          gia_chiet_khau: Number(form.gia_chiet_khau.replace(/\D/g, '')) || 0,
          gia_dai_ly:     Number(form.gia_dai_ly.replace(/\D/g, '')) || 0,
          gia_npp:        Number(form.gia_npp.replace(/\D/g, '')) || 0,
          hh_kd:          Number(form.hh_kd) || 0,
          mo_ta: form.mo_ta,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo sản phẩm'); return }
      onCreated(data.data)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <BottomSheet title="Thêm sản phẩm" onClose={onClose}>
      <Field label="TÊN SẢN PHẨM *" value={form.ten_sp} onChange={v => set('ten_sp', v)} placeholder="Lọc tổng Pentair..." />
      <Field label="MÃ SP" value={form.ma_sp} onChange={v => set('ma_sp', v)} placeholder="SP001" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="PHÂN LOẠI" value={form.phan_loai} onChange={v => set('phan_loai', v)} placeholder="Lọc tổng" />
        <Field label="NHÓM SP" value={form.nhom_sp} onChange={v => set('nhom_sp', v)} placeholder="Nhóm A" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="GIÁ NIÊM YẾT" value={form.gia_niem_yet} onChange={v => set('gia_niem_yet', v)} placeholder="65000000" type="number" />
        <Field label="GIÁ CHIẾT KHẤU" value={form.gia_chiet_khau} onChange={v => set('gia_chiet_khau', v)} placeholder="60000000" type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="GIÁ ĐẠI LÝ" value={form.gia_dai_ly} onChange={v => set('gia_dai_ly', v)} placeholder="55000000" type="number" />
        <Field label="GIÁ NPP" value={form.gia_npp} onChange={v => set('gia_npp', v)} placeholder="50000000" type="number" />
      </div>
      <Field label="% HOA HỒNG KD" value={form.hh_kd} onChange={v => set('hh_kd', v)} placeholder="3" type="number" />
      <TextArea label="MÔ TẢ" value={form.mo_ta} onChange={v => set('mo_ta', v)} placeholder="Mô tả sản phẩm..." />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button onClick={onClose}
          className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">
          Hủy
        </button>
        <button onClick={submit} disabled={saving}
          className="py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60">
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </BottomSheet>
  )
}

// ─── Import Excel Sheet ────────────────────────────────────────────────────────

// Excel column headers that map to our fields
const EXCEL_COLUMNS: Record<string, keyof Product> = {
  'Tên sản phẩm':       'ten_sp',
  'Mã SP':              'ma_sp',
  'Phân loại':          'phan_loai',
  'Nhóm SP':            'nhom_sp',
  'Giá niêm yết':       'gia_niem_yet',
  'Giá niêm yết (VNĐ)': 'gia_niem_yet',
  'Giá chiết khấu':     'gia_chiet_khau',
  'Giá đại lý':         'gia_dai_ly',
  'Giá NPP':            'gia_npp',
  'Giá nhà phân phối':  'gia_npp',
  '% Hoa hồng KD':      'hh_kd',
  'Hoa hồng KD':        'hh_kd',
  'Mô tả':              'mo_ta',
}

function ImportSheet({ onClose, onDone }: { onClose: () => void; onDone: (created: number, updated: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows]       = useState<Partial<Product>[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError]     = useState('')
  const [parseError, setParseError] = useState('')

  const parseFile = (file: File) => {
    setParseError(''); setRows([])
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const mapped = raw.map(row => {
          const p: Partial<Product> = {}
          for (const [header, field] of Object.entries(EXCEL_COLUMNS)) {
            if (row[header] !== undefined && row[header] !== '') {
              const val = row[header]
              if (['gia_niem_yet','gia_chiet_khau','gia_dai_ly','gia_npp','hh_kd'].includes(field)) {
                (p as Record<string, unknown>)[field] = Number(String(val).replace(/[,.\s]/g, '')) || 0
              } else {
                (p as Record<string, unknown>)[field] = String(val)
              }
            }
          }
          return p
        }).filter(p => p.ten_sp || p.ma_sp)

        if (mapped.length === 0) {
          setParseError('Không tìm thấy dữ liệu hợp lệ. Kiểm tra lại tên cột trong file.')
          return
        }
        setRows(mapped)
      } catch {
        setParseError('Không đọc được file. Vui lòng dùng file .xlsx hoặc .csv')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    parseFile(file)
  }

  const doImport = async () => {
    if (rows.length === 0) return
    setImporting(true); setError('')
    try {
      const res = await fetch('/api/lark/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi import'); return }
      onDone(data.created, data.updated)
    } catch { setError('Lỗi kết nối') }
    finally { setImporting(false) }
  }

  const downloadTemplate = () => {
    const headers = ['Tên sản phẩm','Mã SP','Phân loại','Nhóm SP','Giá niêm yết (VNĐ)','Giá chiết khấu','Giá đại lý','Giá nhà phân phối','% Hoa hồng KD','Mô tả']
    const ws = XLSX.utils.aoa_to_sheet([headers])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm')
    XLSX.writeFile(wb, 'template_san_pham.xlsx')
  }

  return (
    <BottomSheet title="Import từ Excel" onClose={onClose}>
      {/* Template download */}
      <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-800">Tải file mẫu</p>
          <p className="text-xs text-blue-600 mt-0.5">Điền đúng tên cột để hệ thống nhận diện</p>
        </div>
        <button onClick={downloadTemplate}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium flex-shrink-0">
          ↓ Tải mẫu
        </button>
      </div>

      {/* Column mapping guide */}
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-600 mb-2">Tên cột nhận diện:</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {['Tên sản phẩm','Mã SP','Phân loại','Nhóm SP','Giá niêm yết (VNĐ)','Giá chiết khấu','Giá đại lý','Giá nhà phân phối','% Hoa hồng KD','Mô tả'].map(h => (
            <p key={h} className="text-xs text-gray-500">• {h}</p>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Nếu Mã SP đã tồn tại → cập nhật. Chưa có → tạo mới.</p>
      </div>

      {/* File picker */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFile}
        />
        <button onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 flex flex-col items-center gap-2 active:bg-gray-50">
          <span className="text-2xl">📂</span>
          <p className="text-sm font-medium text-gray-600">{fileName || 'Chọn file Excel / CSV'}</p>
          <p className="text-xs text-gray-500">.xlsx, .xls, .csv</p>
        </button>
      </div>

      {parseError && <p className="text-red-600 text-sm">{parseError}</p>}

      {rows.length > 0 && (
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-sm font-semibold text-green-800">✓ Đọc được {rows.length} sản phẩm</p>
          <p className="text-xs text-green-600 mt-0.5">
            Preview: {rows.slice(0, 3).map(r => r.ten_sp || r.ma_sp).join(', ')}
            {rows.length > 3 ? ` và ${rows.length - 3} sản phẩm khác...` : ''}
          </p>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button onClick={onClose}
          className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">
          Hủy
        </button>
        <button onClick={doImport} disabled={rows.length === 0 || importing}
          className="py-3 bg-green-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
          {importing ? 'Đang import...' : `Import ${rows.length > 0 ? rows.length + ' SP' : ''}`}
        </button>
      </div>
    </BottomSheet>
  )
}

// ─── Product Image ─────────────────────────────────────────────────────────────

function productImageUrl(recordId: string, opts?: { size?: number; bust?: number }) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const px = opts?.size ?? 0
  if (px > 0) {
    const params = `width=${px * 2}&height=${px * 2}&resize=cover${opts?.bust ? `&t=${opts.bust}` : ''}`
    return `${base}/storage/v1/render/image/public/product-images/${recordId}?${params}`
  }
  return `${base}/storage/v1/object/public/product-images/${recordId}${opts?.bust ? `?t=${opts.bust}` : ''}`
}

function ProductThumb({ recordId, size = 64 }: { recordId: string; size?: number }) {
  const [show, setShow] = useState(true)
  if (!show) return (
    <div
      style={{ width: size, height: size }}
      className="rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"
    >
      <span className="text-2xl">📦</span>
    </div>
  )
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={productImageUrl(recordId, { size })}
      alt=""
      style={{ width: size, height: size }}
      className="rounded-xl object-cover flex-shrink-0 bg-gray-100"
      onError={() => setShow(false)}
    />
  )
}

// ─── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ p, onClick, isAdmin }: { p: Product; onClick: () => void; isAdmin: boolean }) {
  return (
    <button onClick={onClick} className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform">
      <div className="flex items-start gap-3">
        <ProductThumb recordId={p.record_id} size={64} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-gray-800 text-sm leading-snug">{p.ten_sp}</p>
            {p.nhom_sp && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                {p.nhom_sp}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{p.ma_sp}{p.phan_loai ? ` · ${p.phan_loai}` : ''}</p>

          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <p className="text-xs text-gray-500">Niêm yết</p>
              <p className="text-sm font-bold text-gray-800">{fmtMoney(p.gia_niem_yet)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Chiết khấu</p>
              <p className="text-sm font-semibold text-blue-600">{fmtMoney(p.gia_chiet_khau)}</p>
            </div>
            {isAdmin && (
              <>
                <div>
                  <p className="text-xs text-gray-500">Đại lý</p>
                  <p className="text-sm font-semibold text-green-600">{fmtMoney(p.gia_dai_ly)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">NPP</p>
                  <p className="text-sm font-semibold text-orange-600">{fmtMoney(p.gia_npp)}</p>
                </div>
              </>
            )}
          </div>

          {p.hh_kd > 0 && (
            <p className="text-xs text-gray-500 mt-1.5">HH KD: <span className="text-gray-600 font-medium">{p.hh_kd}%</span></p>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [filterPhanLoai, setFilterPhanLoai] = useState('all')
  const [showAdd, setShowAdd]   = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importMsg, setImportMsg]   = useState('')
  const [isAdmin, setIsAdmin]   = useState(false)
  const [showActions, setShowActions] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/lark/products')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setProducts(json.data ?? [])
    } catch { setError('Không tải được sản phẩm') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    // Check role
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d?.role === 'admin' || d?.role === 'manager') setIsAdmin(true)
    }).catch(() => {})
  }, [load])

  const phanLoaiOptions = ['all', ...Array.from(new Set(products.map(p => p.phan_loai).filter(Boolean)))]

  const filtered = products.filter(p => {
    if (filterPhanLoai !== 'all' && p.phan_loai !== filterPhanLoai) return false
    if (search) {
      const q = search.toLowerCase()
      return (p.ten_sp + p.ma_sp + p.phan_loai + p.nhom_sp).toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Sản phẩm</h1>
            <p className="text-xs text-gray-500">
              {loading ? 'Đang tải...' : `${products.length} sản phẩm`}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowActions(true)}
              className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5">
              <span className="text-base leading-none">+</span> Thêm
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="search"
            placeholder="Tìm tên, mã, phân loại..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400"
          />
        </div>

        {/* Phân loại filter */}
        {phanLoaiOptions.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {phanLoaiOptions.map(pl => (
              <button
                key={pl}
                onClick={() => setFilterPhanLoai(pl)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterPhanLoai === pl ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {pl === 'all' ? 'Tất cả' : pl}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Import success message */}
      {importMsg && (
        <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-green-700 font-medium">{importMsg}</p>
          <button onClick={() => setImportMsg('')} className="text-green-500 text-lg leading-none">×</button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>
        )}
        {!loading && error && (
          <div className="flex flex-col items-center py-16 gap-3">
            <p className="text-gray-400 text-sm">{error}</p>
            <button onClick={load} className="text-blue-600 text-sm font-medium">Thử lại</button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-2">
            <span className="text-4xl">📦</span>
            <p className="text-gray-500 text-sm font-medium">Chưa có sản phẩm</p>
          </div>
        )}
        {!loading && !error && filtered.map(p => (
          <ProductCard
            key={p.record_id}
            p={p}
            isAdmin={isAdmin}
            onClick={() => router.push(`/dashboard/products/${p.record_id}`)}
          />
        ))}
      </div>

      {/* Admin actions sheet */}
      {showActions && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={e => e.target === e.currentTarget && setShowActions(false)}>
          <div className="bg-white rounded-t-3xl pb-8">
            <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Thêm sản phẩm</h2>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => { setShowActions(false); setShowAdd(true) }}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl text-left"
              >
                <span className="text-2xl">➕</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Thêm thủ công</p>
                  <p className="text-xs text-gray-500">Nhập từng sản phẩm qua form</p>
                </div>
              </button>
              <button
                onClick={() => { setShowActions(false); setShowImport(true) }}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl text-left"
              >
                <span className="text-2xl">📊</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Import từ Excel</p>
                  <p className="text-xs text-gray-500">Tải lên file .xlsx / .csv, tự tạo hoặc cập nhật hàng loạt</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <AddProductForm
          onClose={() => setShowAdd(false)}
          onCreated={p => { setProducts(prev => [p, ...prev]); setShowAdd(false) }}
        />
      )}

      {showImport && (
        <ImportSheet
          onClose={() => setShowImport(false)}
          onDone={(created, updated) => {
            setShowImport(false)
            setImportMsg(`✅ Import xong: ${created} tạo mới, ${updated} cập nhật`)
            load() // Reload list
          }}
        />
      )}
    </div>
  )
}
