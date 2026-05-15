'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import * as XLSX from 'xlsx'
import { usePullToRefresh, PullIndicator } from '@/components/PullToRefresh'
import { PIPELINE_STAGES, PIPELINE_COLORS, PRIORITY_COLORS, NGUON_KH_OPTIONS, LOAI_HINH_NHA_OPTIONS } from '@/lib/lark/tables'
import { computeHealthScore } from '@/lib/health'
import type { Customer } from '@/app/api/lark/customers/route'
import type { Quote } from '@/app/api/lark/quotes/_mappers'
import type { Product } from '@/app/api/lark/products/_mapper'
import { useQuoteItems, itemsToLarkFields } from '@/components/QuoteItemsEditor'

const formatPhone = (p: string) => p.replace(/^84/, '0')

const formatDate = (ms: number | null) => {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formatMoney = (n: number) =>
  n ? n.toLocaleString('vi-VN') + '₫' : ''

// ─── Excel column mapping ─────────────────────────────────────────────────────

const EXCEL_COLS: Record<string, string> = {
  'Họ tên KH':           'ho_ten',
  'SĐT':                 'sdt',
  'SĐT phụ':             'sdt_khac',
  'Email':               'email',
  'Địa chỉ HĐ':          'dia_chi_hd',
  'Địa chỉ CT':          'dia_chi_ct',
  'Pipeline':            'pipeline',
  'Nguồn KH':            'nguon_kh',
  'Loại hình nhà':       'loai_hinh_nha',
  'Nguồn nước':          'nguon_nuoc',
  'Mức ưu tiên':         'muc_uu_tien',
  'Báo giá (VNĐ)':       'bao_gia',
  'Nội dung':            'noi_dung',
  'Người phụ trách':     'nguoi_phu_trach',
  'Loại KH':             'loai_kh',
  'Khu vực':             'khu_vuc',
  'Nhóm dịch vụ':        'nhom_dv',
  'Ngày liên hệ đầu':    'ngay_lien_he_dau',
}

const TEMPLATE_HEADERS = Object.keys(EXCEL_COLS)

// Hướng dẫn cho sheet 2
const PIPELINE_GUIDE = [
  ['Lead mới',   'Mới tiếp cận, chưa qualify'],
  ['Tiềm năng',  'Đã qualify, đang theo dõi'],
  ['Báo giá',    'Đã gửi báo giá'],
  ['Đàm phán',   'Đang thương lượng giá'],
  ['Chốt HĐ',   'Đã ký hợp đồng'],
  ['Giao hàng',  'Đang giao / lắp đặt'],
  ['Nghiệm thu', 'Đã lắp xong, đang nghiệm thu'],
  ['Bảo hành',   'Đang trong thời hạn bảo hành → KH cũ còn BH'],
  ['Bảo trì',    'Đang có HĐ bảo trì định kỳ → KH cũ đang BT'],
  ['Lost',       'Không chốt được, ngừng liên hệ'],
]

// ─── Import Sheet ─────────────────────────────────────────────────────────────

interface ImportSheetProps {
  onClose: () => void
  onDone: () => void
}

interface ImportResult {
  created:           number
  skipped_invalid:   number
  skipped_duplicate: number
  unassigned:        number
  details: {
    invalid_rows:    number[]
    duplicate_sdts:  string[]
    unassigned_names: string[]
  }
}

function ImportSheet({ onClose, onDone }: ImportSheetProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]   = useState<{ row: Record<string, string>; warnings: string[] }[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [error, setError]       = useState('')
  const [staffList, setStaffList] = useState<string[]>([])

  // Load danh sách nhân viên để hiển thị trong template hướng dẫn
  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => {
        const names = (d.data ?? [])
          .filter((u: { role: string; is_active: boolean }) =>
            ['sales','tech','logistics','admin','ceo','director'].includes(u.role) && u.is_active
          )
          .map((u: { full_name: string }) => u.full_name)
          .filter(Boolean)
        setStaffList(names)
      })
      .catch(() => {})
  }, [])

  function downloadTemplate() {
    const wb = XLSX.utils.book_new()

    // ── Sheet 1: Dữ liệu ─────────────────────────────────────────────────────
    const ws1 = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS])
    ws1['!cols'] = TEMPLATE_HEADERS.map(h =>
      ({ wch: h === 'Họ tên KH' ? 25 : h.includes('Địa') ? 35 : h === 'Nội dung' ? 30 : 18 })
    )
    XLSX.utils.book_append_sheet(wb, ws1, 'Khách hàng')

    // ── Sheet 2: Hướng dẫn ───────────────────────────────────────────────────
    const guide: (string | number)[][] = [
      ['HƯỚNG DẪN ĐIỀN FILE IMPORT KHÁCH HÀNG'],
      [],
      ['── PIPELINE (cột "Pipeline") ──', '', 'Dùng khi nào?'],
      ...PIPELINE_GUIDE.map(([val, desc]) => ['', val, desc]),
      [],
      ['── LOẠI KH (cột "Loại KH") ──'],
      ['', 'B2C',    'Khách dân dụng / cá nhân'],
      ['', 'Đại lý', 'Đại lý phân phối / bán lại'],
      ['', 'Dự án',  'Công trình / quy mô lớn'],
      [],
      ['── KHU VỰC (cột "Khu vực") ──'],
      ['', 'Miền Nam'],
      ['', 'Miền Bắc'],
      ['', 'Miền Trung'],
      [],
      ['── NHÓM DỊCH VỤ (cột "Nhóm dịch vụ") ──'],
      ['', 'BL1 — Lắp đặt trọn gói'],
      ['', 'BL1 + BL3 — Lắp đặt + Định kỳ'],
      ['', 'BL2 — Thương mại'],
      ['', 'BL3 — Dịch vụ định kỳ'],
      [],
      ['── NGÀY LIÊN HỆ (cột "Ngày liên hệ đầu") ──'],
      ['', 'Format: dd/mm/yyyy (ví dụ: 15/03/2024)'],
      ['', 'Để trống = dùng ngày import hôm nay'],
      [],
      ['── NGƯỜI PHỤ TRÁCH — copy chính xác tên bên dưới ──'],
      ...staffList.map(name => ['', name]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(guide)
    ws2['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Hướng dẫn')

    XLSX.writeFile(wb, 'template_khach_hang.xlsx')
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError('')
    setResult(null)

    const reader = new FileReader()
    reader.onload = ev => {
      const wb = XLSX.read(ev.target?.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      const rows = raw.map(row => {
        const mapped: Record<string, string> = {}
        for (const [header, key] of Object.entries(EXCEL_COLS)) {
          mapped[key] = String(row[header] ?? '')
        }
        return mapped
      })
      // Preview 5 dòng đầu + cảnh báo
      const VALID_PL = new Set(['Lead mới','Tiềm năng','Báo giá','Đàm phán','Chốt HĐ','Giao hàng','Nghiệm thu','Bảo hành','Bảo trì','Lost'])
      const VALID_LKH = new Set(['B2C','Đại lý','Dự án'])
      const previewed = rows.slice(0, 5).map(r => {
        const warnings: string[] = []
        if (!r.ho_ten?.trim()) warnings.push('Thiếu họ tên → sẽ bỏ qua')
        if (!r.sdt?.trim())    warnings.push('Thiếu SĐT → sẽ bỏ qua')
        if (r.pipeline && !VALID_PL.has(r.pipeline)) warnings.push(`Pipeline "${r.pipeline}" không hợp lệ → về "Lead mới"`)
        if (r.loai_kh && !VALID_LKH.has(r.loai_kh)) warnings.push(`Loại KH "${r.loai_kh}" không hợp lệ → bỏ qua`)
        if (r.nguoi_phu_trach && !staffList.includes(r.nguoi_phu_trach)) warnings.push(`NV "${r.nguoi_phu_trach}" không tìm thấy → chưa phân công`)
        return { row: r, warnings }
      })
      setPreview(previewed)
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (!fileRef.current?.files?.[0]) return
    setImporting(true)
    setError('')

    const file = fileRef.current.files[0]
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const rows = raw.map(row => {
          const mapped: Record<string, unknown> = {}
          for (const [header, key] of Object.entries(EXCEL_COLS)) {
            const v = String(row[header] ?? '').trim()
            mapped[key] = key === 'bao_gia' ? (v ? Number(v.replace(/\D/g, '')) : 0) : v
          }
          return mapped
        })

        const res = await fetch('/api/lark/customers/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Lỗi import'); return }
        setResult(data as ImportResult)
        onDone()
      } catch {
        setError('Lỗi xử lý file')
      } finally {
        setImporting(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Import Excel</h2>
          <button onClick={onClose} className="text-gray-400 p-1">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Template download */}
          <div className="bg-blue-50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-800">File mẫu (template)</p>
              <p className="text-xs text-blue-600 mt-0.5">Tải về, điền đúng cột, rồi upload</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
            >
              Tải template
            </button>
          </div>

          {/* File picker */}
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-2 block">CHỌN FILE EXCEL</label>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-6 text-center text-gray-400 text-sm hover:border-blue-300 transition-colors"
            >
              {fileName ? (
                <span className="text-gray-700 font-medium">{fileName}</span>
              ) : (
                <>
                  <div className="text-2xl mb-1">📂</div>
                  Nhấn để chọn file .xlsx
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">XEM TRƯỚC (5 dòng đầu)</p>
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                {preview.map(({ row, warnings }, i) => (
                  <div key={i} className={`px-3 py-2 text-xs border-b border-gray-100 last:border-0 ${!row.ho_ten ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={warnings.some(w => w.includes('bỏ qua')) ? 'text-red-400' : 'text-green-500'}>
                        {warnings.some(w => w.includes('bỏ qua')) ? '❌' : '✅'}
                      </span>
                      <span className="font-semibold text-gray-700">{row.ho_ten || '(trống)'}</span>
                      <span className="text-gray-400">{row.sdt}</span>
                      {row.pipeline && <span className="text-blue-500">· {row.pipeline}</span>}
                    </div>
                    {warnings.map((w, wi) => (
                      <p key={wi} className="text-orange-500 mt-0.5 pl-5">⚠ {w}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-xl overflow-hidden border border-gray-100 text-sm">
              <div className="bg-green-50 px-4 py-2.5 flex items-center gap-2 font-medium text-green-700">
                <span>✅</span> Đã tạo: <strong>{result.created}</strong> khách hàng
              </div>
              {result.unassigned > 0 && (
                <div className="bg-yellow-50 px-4 py-2 text-yellow-700">
                  ⚠️ Chưa có người phụ trách: <strong>{result.unassigned}</strong> KH
                  {result.details.unassigned_names.length > 0 && (
                    <p className="text-xs mt-0.5 text-yellow-600">{result.details.unassigned_names.slice(0,3).join(', ')}{result.details.unassigned_names.length > 3 ? ` +${result.details.unassigned_names.length - 3}` : ''}</p>
                  )}
                </div>
              )}
              {result.skipped_duplicate > 0 && (
                <div className="bg-blue-50 px-4 py-2 text-blue-700">
                  🔁 Trùng SĐT, bỏ qua: <strong>{result.skipped_duplicate}</strong> KH
                </div>
              )}
              {result.skipped_invalid > 0 && (
                <div className="bg-red-50 px-4 py-2 text-red-600">
                  ❌ Thiếu thông tin bắt buộc: <strong>{result.skipped_invalid}</strong> dòng
                  {result.details.invalid_rows.length > 0 && (
                    <span className="text-xs ml-1">(dòng {result.details.invalid_rows.join(', ')})</span>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 sheet-safe">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">
            Đóng
          </button>
          <button
            onClick={handleImport}
            disabled={!fileName || importing || !!result}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl text-sm"
          >
            {importing ? 'Đang import...' : `Import${preview.length ? '' : ' file'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Quote (từ trang Khách hàng) ─────────────────────────────────────────

function AddQuoteFromCustomerForm({ customer, onClose, onCreated }: {
  customer: Customer
  onClose: () => void
  onCreated: () => void
}) {
  const DRAFT_KEY = `quote_draft_${customer.record_id}`
  const { items, total, addItem, addBlank, removeItem, changeItem, clear } = useQuoteItems(DRAFT_KEY)

  const [chiet_khau,        setChietKhau]        = useState('0')
  const [ghi_chu_ky_thuat,  setGhiChuKyThuat]    = useState('')
  const [ghi_chu_thuong_mai, setGhiChuThuongMai] = useState('')
  const [products,    setProducts]    = useState<Product[]>([])
  const [showPicker,  setShowPicker]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const ck      = Number(chiet_khau) || 0
  const afterCK = Math.round(total * (1 - ck / 100))
  const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '0₫'

  const loadProducts = () => {
    if (products.length > 0) { setShowPicker(true); return }
    fetch('/api/lark/products')
      .then(r => r.json())
      .then(d => { setProducts(d.data ?? []); setShowPicker(true) })
  }

  const submit = async () => {
    if (items.length === 0) { setError('Vui lòng thêm ít nhất 1 sản phẩm'); return }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const { san_pham } = itemsToLarkFields(items)
      const res = await fetch('/api/lark/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          khach_hang:         customer.ho_ten,
          sdt:                customer.sdt,
          san_pham,
          tong_gia_tri:       total,
          chiet_khau:         ck,
          ghi_chu_ky_thuat,
          ghi_chu_thuong_mai,
          customer_record_id: customer.record_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo báo giá'); return }
      clear()
      onCreated()
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <>
      {showPicker && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-white">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <button onClick={() => setShowPicker(false)} className="text-gray-500 p-2.5 -ml-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-base font-bold text-gray-800">Chọn sản phẩm</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {products.map(p => (
              <button key={p.record_id}
                onClick={() => { addItem({ ten_sp: p.ten_sp, don_gia: p.gia_chiet_khau || p.gia_niem_yet || 0 }); setShowPicker(false) }}
                className="w-full px-4 py-3.5 border-b border-gray-50 text-left flex justify-between items-center active:bg-blue-50">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.ten_sp}</p>
                  <p className="text-xs text-gray-400">{p.ma_sp}</p>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {(p.gia_chiet_khau > 0 ? p.gia_chiet_khau : p.gia_niem_yet).toLocaleString('vi-VN')}₫
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40"
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col">
          <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-800">Tạo báo giá</h2>
              <p className="text-xs text-gray-400">{customer.ho_ten}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 p-1">✕</button>
          </div>

          {error && (
            <div className="mx-5 mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium flex-shrink-0">{error}</div>
          )}

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500">SẢN PHẨM ĐỀ XUẤT</label>
                {items.length > 0 && <button onClick={clear} className="text-xs text-red-400 font-medium">Xoá tất cả</button>}
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
                        <button onClick={() => changeItem(item.id, 'so_luong', Math.max(1, item.so_luong - 1))} className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-md hover:bg-gray-100">−</button>
                        <span className="text-sm font-semibold text-gray-700 w-6 text-center">{item.so_luong}</span>
                        <button onClick={() => changeItem(item.id, 'so_luong', item.so_luong + 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-md hover:bg-gray-100">+</button>
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
                <button onClick={loadProducts} className="flex-1 border-2 border-dashed border-blue-200 rounded-xl py-2.5 text-xs text-blue-600 font-semibold">+ Chọn từ danh mục</button>
                <button onClick={addBlank} className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-xs text-gray-500 font-semibold">+ Nhập thủ công</button>
              </div>

              {items.length > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                  <span className="text-xs text-gray-400">{items.length} sản phẩm</span>
                  <span className="text-sm font-bold text-gray-800">{fmtMoney(total)}</span>
                </div>
              )}
            </div>

            {/* Discount */}
            <div>
              <label className="text-sm font-semibold text-gray-600 mb-1 block">CHIẾT KHẤU TỔNG (%)</label>
              <input type="number" value={chiet_khau} onChange={e => setChietKhau(e.target.value)} placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {total > 0 && ck > 0 && (
              <div className="bg-green-50 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-xs text-gray-500">Giá sau chiết khấu</span>
                <span className="text-sm font-bold text-green-600">{fmtMoney(afterCK)}</span>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-gray-600 mb-1 block">GHI CHÚ KỸ THUẬT</label>
              <textarea rows={2} value={ghi_chu_ky_thuat} onChange={e => setGhiChuKyThuat(e.target.value)}
                placeholder="Thông số, yêu cầu lắp đặt..."
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600 mb-1 block">GHI CHÚ THƯƠNG MẠI</label>
              <textarea rows={2} value={ghi_chu_thuong_mai} onChange={e => setGhiChuThuongMai(e.target.value)}
                placeholder="Điều kiện thanh toán, giao hàng..."
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 sheet-safe">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">Huỷ</button>
            <button onClick={submit} disabled={saving} className="flex-1 bg-blue-600 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl text-sm">
              {saving ? 'Đang lưu...' : 'Tạo báo giá'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Add Customer Form ───────────────────────────────────────────────────────

interface AddFormProps {
  onClose: () => void
  onCreated: (c: Customer) => void
}

const NHOM_DV_OPTIONS = [
  'BL1 — Lắp đặt trọn gói',
  'BL1 + BL3 — Lắp đặt + Định kỳ',
  'BL2 — Thương mại',
  'BL3 — Dịch vụ định kỳ',
]

function AddCustomerForm({ onClose, onCreated }: AddFormProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    ho_ten: '', sdt: '', email: '', dia_chi_hd: '',
    pipeline: 'Lead mới', nguon_kh: '', loai_hinh_nha: '',
    muc_uu_tien: 'Trung bình', bao_gia: '', noi_dung: '', nhom_dv: '',
    khu_vuc: '', loai_kh: 'B2C',
  })
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [duplicateId, setDuplicateId] = useState<number | null>(null)
  const [nameDuplicates, setNameDuplicates] = useState<{ id: number; ho_ten: string; sdt: string; pipeline: string }[]>([])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const checkNameDuplicates = async (name: string) => {
    if (name.trim().length < 3) { setNameDuplicates([]); return }
    try {
      const res = await fetch(`/api/lark/customers?check_duplicate=${encodeURIComponent(name.trim())}`)
      const data = await res.json()
      setNameDuplicates(data.duplicates ?? [])
    } catch { /* silent */ }
  }

  const handleSubmit = async () => {
    if (!form.ho_ten.trim() || !form.sdt.trim()) {
      setError('Vui lòng nhập họ tên và số điện thoại')
      return
    }
    const sdtClean = form.sdt.replace(/\s/g, '')
    if (!/^[0-9]{9,11}$/.test(sdtClean)) {
      setError('SĐT không hợp lệ (9–11 chữ số)')
      return
    }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true)
    setError('')
    setDuplicateId(null)
    try {
      const res = await fetch('/api/lark/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sdt: sdtClean,
          bao_gia: form.bao_gia ? Number(form.bao_gia.replace(/\D/g, '')) : 0,
        }),
      })
      const data = await res.json()
      if (res.status === 409 && data.duplicate) {
        setDuplicateId(data.existing_id)
        setError(data.error)
        return
      }
      if (!res.ok) { setError(data.error || 'Lỗi tạo khách hàng'); return }
      onCreated(data.customer)
    } catch {
      setError('Lỗi kết nối')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Thêm khách hàng</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">HỌ TÊN *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nguyễn Văn A"
              value={form.ho_ten}
              onChange={e => { set('ho_ten', e.target.value); setNameDuplicates([]) }}
              onBlur={e => void checkNameDuplicates(e.target.value)}
            />
            {nameDuplicates.length > 0 && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-semibold text-amber-700 mb-1.5">⚠️ Có thể trùng với:</p>
                {nameDuplicates.map(d => (
                  <button key={d.id} type="button"
                    onClick={() => router.push(`/dashboard/customers/${d.id}`)}
                    className="w-full text-left text-xs text-amber-800 py-1 flex items-center gap-2"
                  >
                    <span className="font-medium">{d.ho_ten}</span>
                    <span className="text-amber-500">· {d.sdt} · {d.pipeline}</span>
                    <span className="ml-auto text-blue-600 font-medium">Xem →</span>
                  </button>
                ))}
                <p className="text-[10px] text-amber-500 mt-1">Nhấn tên KH để xem chi tiết. Nếu không trùng, tiếp tục tạo mới.</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">SỐ ĐIỆN THOẠI *</label>
            <input
              type="tel"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0901234567"
              value={form.sdt}
              onChange={e => set('sdt', e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">EMAIL</label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example@gmail.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">TRẠNG THÁI PIPELINE</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.pipeline}
              onChange={e => set('pipeline', e.target.value)}
            >
              {PIPELINE_STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">NGUỒN KHÁCH HÀNG</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.nguon_kh}
              onChange={e => set('nguon_kh', e.target.value)}
            >
              <option value="">— Chọn nguồn —</option>
              {NGUON_KH_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">LOẠI KHÁCH HÀNG</label>
            <div className="flex gap-2">
              {([
                { value: 'B2C',    label: '🏠 B2C',    sub: 'Dân dụng / cá nhân' },
                { value: 'Đại lý', label: '🏪 Đại lý', sub: 'Phân phối / bán lại' },
                { value: 'Dự án', label: '🏗️ Dự án',  sub: 'Công trình / quy mô lớn' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('loai_kh', opt.value)}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                    form.loai_kh === opt.value
                      ? 'bg-blue-600 text-white border-transparent'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className={`text-[10px] mt-0.5 font-normal ${form.loai_kh === opt.value ? 'text-blue-100' : 'text-gray-400'}`}>
                    {opt.sub}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">KHU VỰC</label>
            <div className="flex gap-2">
              {(['Miền Nam', 'Miền Bắc', 'Miền Trung'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => set('khu_vuc', form.khu_vuc === k ? '' : k)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    form.khu_vuc === k
                      ? 'bg-blue-600 text-white border-transparent'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {k.replace('Miền ', '')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">LOẠI HÌNH NHÀ</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.loai_hinh_nha}
              onChange={e => set('loai_hinh_nha', e.target.value)}
            >
              <option value="">— Chọn loại —</option>
              {LOAI_HINH_NHA_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">NHÓM DỊCH VỤ</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.nhom_dv}
              onChange={e => set('nhom_dv', e.target.value)}
            >
              <option value="">— Chọn nhóm dịch vụ —</option>
              {NHOM_DV_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">MỨC ƯU TIÊN</label>
            <div className="flex gap-2">
              {(['Cao', 'Trung bình', 'Thấp'] as const).map(p => {
                const c = PRIORITY_COLORS[p]
                const active = form.muc_uu_tien === p
                return (
                  <button
                    key={p}
                    onClick={() => set('muc_uu_tien', p)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      active ? `${c.bg} ${c.text} border-transparent` : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">GIÁ TRỊ BÁO GIÁ (VNĐ)</label>
            <input
              type="number"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
              value={form.bao_gia}
              onChange={e => set('bao_gia', e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">ĐỊA CHỈ</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Địa chỉ ký hợp đồng"
              value={form.dia_chi_hd}
              onChange={e => set('dia_chi_hd', e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">NỘI DUNG TRAO ĐỔI</label>
            <textarea
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Ghi chú thêm về khách hàng..."
              value={form.noi_dung}
              onChange={e => set('noi_dung', e.target.value)}
            />
          </div>

          {duplicateId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              ⚠️ {error} —{' '}
              <button
                onClick={() => { onClose(); router.push(`/dashboard/customers/${duplicateId}`) }}
                className="text-blue-600 font-semibold underline"
              >
                Xem khách hàng này
              </button>
            </div>
          )}
          {!duplicateId && error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm"
            >
              Huỷ
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl text-sm"
            >
              {saving ? 'Đang lưu...' : 'Lưu khách hàng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Customer Card ────────────────────────────────────────────────────────────

function CustomerCard({ customer, onClick, onCreateQuote, canCreateQuote = true, bulkMode = false, selected = false, onToggleSelect }: {
  customer: Customer
  onClick: () => void
  onCreateQuote: (c: Customer) => void
  canCreateQuote?: boolean
  bulkMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: number) => void
}) {
  const pipeline = customer.pipeline || 'Lead mới'
  const pc  = PIPELINE_COLORS[pipeline] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
  const prc = PRIORITY_COLORS[customer.muc_uu_tien] ?? null
  const health = computeHealthScore({
    ngay_cap_nhat:  customer.ngay_cap_nhat ?? null,
    pipeline,
  })

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-colors ${selected ? 'border-blue-400 bg-blue-50/30' : 'border-gray-100'}`}>
      <button
        onClick={bulkMode ? () => onToggleSelect?.(customer.id) : onClick}
        className="w-full p-4 text-left active:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {bulkMode ? (
              <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${selected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                {selected && <span className="text-white text-lg font-bold">✓</span>}
              </div>
            ) : (
              <div className="w-11 h-11 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">
                  {customer.ho_ten?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-800 text-sm truncate">{customer.ho_ten}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatPhone(customer.sdt)}</p>
              {customer.dia_chi_ct && (
                <p className="text-xs text-gray-400 truncate mt-0.5">{customer.dia_chi_ct}</p>
              )}
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${pc.bg} ${pc.text}`}>
            {pipeline}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {prc && customer.muc_uu_tien && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prc.bg} ${prc.text}`}>
              {customer.muc_uu_tien}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${health.bgColor} ${health.color}`}>
            {health.label}
          </span>
          {customer.khu_vuc && (
            <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">📍 {customer.khu_vuc}</span>
          )}
          {customer.nguoi_phu_trach && (
            <span className="text-xs text-gray-400">👤 {customer.nguoi_phu_trach}</span>
          )}
          {customer.bao_gia > 0 && (
            <span className="text-xs text-green-600 font-medium">{formatMoney(customer.bao_gia)}</span>
          )}
          {customer.ngay_lien_he_dau && (
            <span className="text-xs text-gray-300 ml-auto">
              {formatDate(customer.ngay_lien_he_dau)}
            </span>
          )}
        </div>
      </button>

      {/* Quick action: Tạo báo giá — ẩn với accountant */}
      {canCreateQuote && (
        <div className="border-t border-gray-50 px-4 py-2 flex justify-end">
          <button
            onClick={e => { e.stopPropagation(); onCreateQuote(customer) }}
            className="text-xs text-blue-600 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg active:bg-blue-50"
          >
            <span>📋</span> Tạo báo giá
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Time filter helpers ──────────────────────────────────────────────────────

type TimePreset = 'month' | 'last_month' | 'quarter' | 'custom' | 'all'

function currentYM() {
  const d = new Date()
  return { y: d.getFullYear(), m: d.getMonth() + 1 }
}

function presetLabel(p: TimePreset, customY: number, customM: number) {
  if (p === 'all')        return 'Tất cả'
  if (p === 'month')      return 'Tháng này'
  if (p === 'last_month') return 'Tháng trước'
  if (p === 'quarter')    return 'Quý này'
  return `${String(customM).padStart(2,'0')}/${customY}`
}

function presetRange(p: TimePreset, customY: number, customM: number): [number,number] | null {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1
  if (p === 'all') return null
  if (p === 'month') {
    return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime() - 1]
  }
  if (p === 'last_month') {
    const lm = m === 1 ? 12 : m - 1, ly = m === 1 ? y - 1 : y
    return [new Date(ly, lm - 1, 1).getTime(), new Date(ly, lm, 1).getTime() - 1]
  }
  if (p === 'quarter') {
    const q = Math.floor((m - 1) / 3)
    return [new Date(y, q * 3, 1).getTime(), new Date(y, q * 3 + 3, 1).getTime() - 1]
  }
  // custom
  return [new Date(customY, customM - 1, 1).getTime(), new Date(customY, customM, 1).getTime() - 1]
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const router = useRouter()
  const showToast = useToast()
  const [customers, setCustomers]       = useState<Customer[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [stage, setStage]               = useState<string>('Tất cả')
  const [showForm, setShowForm]         = useState(false)
  const [showImport, setShowImport]     = useState(false)
  const [role, setRole]                 = useState('')
  const [error, setError]               = useState('')
  const [quoteFor, setQuoteFor]         = useState<Customer | null>(null)
  const [bulkMode, setBulkMode]         = useState(false)
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction]     = useState<'assign'|'pipeline'|'khu_vuc'>('assign')
  const [bulkValue, setBulkValue]       = useState('')
  const [bulkSaving, setBulkSaving]     = useState(false)
  const [staffList, setStaffList]       = useState<{ id: string; full_name: string }[]>([])

  // Loại KH filter
  const [loaiKh, setLoaiKh] = useState('Tất cả')

  // Time filter
  const { y: cY, m: cM } = currentYM()
  const [timePreset, setTimePreset]   = useState<TimePreset>('all') // set after role loads
  const [customY, setCustomY]         = useState(cY)
  const [customM, setCustomM]         = useState(cM)
  const [showPicker, setShowPicker]   = useState(false)
  const roleLoaded = useRef(false)

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/lark/customers')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setCustomers(data.customers ?? [])
      const r = data.role ?? ''
      setRole(r)
      // Set default time preset once based on role
      if (!roleLoaded.current) {
        roleLoaded.current = true
        setTimePreset('all')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(`Không tải được dữ liệu: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  // Load staff list cho bulk assign (lazy)
  useEffect(() => {
    if (!bulkMode || staffList.length > 0) return
    fetch('/api/admin/users').then(r => r.json()).then(d => {
      setStaffList((d.data ?? [])
        .filter((u: { is_active: boolean }) => u.is_active)
        .map((u: { id: string; full_name: string }) => ({ id: u.id, full_name: u.full_name }))
      )
    }).catch(() => {})
  }, [bulkMode])

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const applyBulkAction = async () => {
    if (!bulkValue || selectedIds.size === 0) return
    setBulkSaving(true)
    try {
      const res = await fetch('/api/lark/customers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: bulkAction, value: bulkValue }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Lỗi', true); return }
      showToast(`Đã cập nhật ${data.updated} khách hàng`)
      setSelectedIds(new Set())
      setBulkMode(false)
      setBulkValue('')
      void loadCustomers()
    } catch { showToast('Lỗi kết nối', true) }
    finally { setBulkSaving(false) }
  }

  const ptr = usePullToRefresh(loadCustomers)

  const timeRange = presetRange(timePreset, customY, customM)

  const filtered = customers.filter(c => {
    const matchStage  = stage === 'Tất cả' || c.pipeline === stage
    const matchLoai   = loaiKh === 'Tất cả' || (c.loai_kh || 'B2C') === loaiKh
    const q = search.toLowerCase()
    const matchSearch = !q || [c.ho_ten, c.sdt, c.email, c.dia_chi_ct, c.nguoi_phu_trach]
      .some(v => v?.toLowerCase().includes(q))
    const matchTime = !timeRange || (
      c.ngay_lien_he_dau !== null &&
      c.ngay_lien_he_dau >= timeRange[0] &&
      c.ngay_lien_he_dau <= timeRange[1]
    )
    return matchStage && matchLoai && matchSearch && matchTime
  })

  const handleCreated = (c: Customer) => {
    setCustomers(prev => [c, ...prev])
    setShowForm(false)
    showToast('Đã tạo khách hàng thành công')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Khách hàng</h1>
            <p className="text-xs text-gray-400">
              {loading ? 'Đang tải...' : `${filtered.length}/${customers.length} khách hàng`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {['admin', 'ceo', 'director'].includes(role) && !bulkMode && (
              <button
                onClick={() => setBulkMode(true)}
                className="border border-gray-200 text-gray-600 text-xs font-medium px-3 py-2 rounded-xl"
              >
                ☑️ Chọn nhiều
              </button>
            )}
            {bulkMode && (
              <button
                onClick={() => { setBulkMode(false); setSelectedIds(new Set()); setBulkValue('') }}
                className="border border-red-200 text-red-500 text-xs font-medium px-3 py-2 rounded-xl"
              >
                Huỷ
              </button>
            )}
            {!bulkMode && ['admin', 'ceo', 'director'].includes(role) && (
              <button
                onClick={() => setShowImport(true)}
                className="border border-gray-200 text-gray-600 text-sm font-medium px-3 py-2 rounded-xl flex items-center gap-1.5"
              >
                Import
              </button>
            )}
            {!bulkMode && ['admin', 'ceo', 'director', 'sales'].includes(role) && (
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <span className="text-base leading-none">+</span> Thêm mới
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tìm tên, SĐT, địa chỉ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-base"
            >✕</button>
          )}
        </div>

        {/* Time filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 shrink-0">Thời gian:</span>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
            {(['month', 'last_month', 'quarter', 'all'] as TimePreset[]).map(p => (
              <button
                key={p}
                onClick={() => { setTimePreset(p); setShowPicker(false) }}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  timePreset === p && p !== 'custom'
                    ? 'bg-blue-600 text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                {presetLabel(p, customY, customM)}
              </button>
            ))}
            <button
              onClick={() => setShowPicker(v => !v)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                timePreset === 'custom'
                  ? 'bg-blue-600 text-white border-transparent'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {timePreset === 'custom' ? presetLabel('custom', customY, customM) : 'Tùy chọn'}
            </button>
          </div>
        </div>

        {/* Month/year picker */}
        {showPicker && (
          <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2.5">
            <select
              value={customM}
              onChange={e => { setCustomM(Number(e.target.value)); setTimePreset('custom') }}
              className="text-sm bg-white border border-blue-200 rounded-lg px-2 py-1 outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <select
              value={customY}
              onChange={e => { setCustomY(Number(e.target.value)); setTimePreset('custom') }}
              className="text-sm bg-white border border-blue-200 rounded-lg px-2 py-1 outline-none"
            >
              {Array.from({ length: 5 }, (_, i) => cY - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={() => setShowPicker(false)}
              className="text-blue-600 text-sm font-semibold ml-auto"
            >Xong</button>
          </div>
        )}

        {/* Loại KH filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {([
            { value: 'Tất cả', icon: '👥' },
            { value: 'B2C',    icon: '🏠' },
            { value: 'Đại lý', icon: '🏪' },
            { value: 'Dự án',  icon: '🏗️' },
          ]).map(opt => {
            const active = loaiKh === opt.value
            const count = opt.value === 'Tất cả'
              ? customers.length
              : customers.filter(c => (c.loai_kh || 'B2C') === opt.value).length
            return (
              <button
                key={opt.value}
                onClick={() => setLoaiKh(opt.value)}
                className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  active
                    ? 'bg-blue-600 text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                <span>{opt.icon}</span>
                <span>{opt.value}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Pipeline stage filter chips */}
        <div className="flex flex-wrap gap-2">
          {(['Tất cả', ...PIPELINE_STAGES] as const).map(s => {
            const active = stage === s
            const pc = s !== 'Tất cả' ? PIPELINE_COLORS[s] : null
            const count = s === 'Tất cả' ? customers.length : customers.filter(c => c.pipeline === s).length
            return (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  active
                    ? pc
                      ? `${pc.bg} ${pc.text} border-transparent`
                      : 'bg-blue-600 text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                {s} <span className="opacity-60">{count}</span>
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
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm mb-3">{error}</p>
            <button onClick={loadCustomers} className="text-blue-600 text-sm font-semibold">Thử lại</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2">
            <span className="text-4xl">{search || stage !== 'Tất cả' ? '🔍' : '👥'}</span>
            <p className="text-sm font-medium text-gray-500">{search || stage !== 'Tất cả' ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có khách hàng nào'}</p>
          </div>
        ) : (
          filtered.map(c => (
            <CustomerCard
              key={c.record_id}
              customer={c}
              onClick={() => router.push(`/dashboard/customers/${c.record_id}`)}
              onCreateQuote={c => setQuoteFor(c)}
              canCreateQuote={['admin', 'ceo', 'director', 'sales'].includes(role) && !bulkMode}
              bulkMode={bulkMode}
              selected={selectedIds.has(c.id)}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4">
          <div className="bg-gray-900 rounded-2xl p-4 shadow-xl space-y-3">
            <p className="text-white text-sm font-semibold text-center">
              Đã chọn {selectedIds.size} khách hàng
            </p>
            <div className="flex gap-2">
              <select value={bulkAction}
                onChange={e => { setBulkAction(e.target.value as typeof bulkAction); setBulkValue('') }}
                className="flex-shrink-0 bg-gray-800 text-white text-xs rounded-xl px-3 py-2 border border-gray-700 focus:outline-none"
              >
                <option value="assign">Giao cho</option>
                <option value="pipeline">Pipeline</option>
                <option value="khu_vuc">Khu vực</option>
              </select>
              {bulkAction === 'assign' && (
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                  className="flex-1 bg-gray-800 text-white text-xs rounded-xl px-3 py-2 border border-gray-700 focus:outline-none">
                  <option value="">— Chọn NV —</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              )}
              {bulkAction === 'pipeline' && (
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                  className="flex-1 bg-gray-800 text-white text-xs rounded-xl px-3 py-2 border border-gray-700 focus:outline-none">
                  <option value="">— Chọn stage —</option>
                  {PIPELINE_STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              )}
              {bulkAction === 'khu_vuc' && (
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                  className="flex-1 bg-gray-800 text-white text-xs rounded-xl px-3 py-2 border border-gray-700 focus:outline-none">
                  <option value="">— Chọn khu vực —</option>
                  <option>Miền Nam</option>
                  <option>Miền Bắc</option>
                  <option>Miền Trung</option>
                </select>
              )}
            </div>
            <button onClick={applyBulkAction} disabled={!bulkValue || bulkSaving}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
              {bulkSaving ? 'Đang cập nhật...' : 'Áp dụng'}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <AddCustomerForm onClose={() => setShowForm(false)} onCreated={handleCreated} />
      )}

      {showImport && (
        <ImportSheet
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); loadCustomers() }}
        />
      )}

      {quoteFor && (
        <AddQuoteFromCustomerForm
          customer={quoteFor}
          onClose={() => setQuoteFor(null)}
          onCreated={() => setQuoteFor(null)}
        />
      )}
    </div>
  )
}
