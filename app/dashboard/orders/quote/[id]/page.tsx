'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { QUOTE_STATUSES, QUOTE_STATUS_COLORS, NGUON_KH_OPTIONS } from '@/lib/lark/tables'
import type { Quote } from '@/app/api/lark/quotes/_mappers'
import { useQuoteItems, itemsToLarkFields } from '@/components/QuoteItemsEditor'
import type { Product } from '@/app/api/lark/products/_mapper'
async function fetchCompany() {
  try {
    const res = await fetch('/api/admin/settings')
    const d   = await res.json()
    return d.data ?? {}
  } catch { return {} }
}

const downloadQuotePDF = async (quote: Quote) => {
  const [{ downloadQuotePDF: dl }, company] = await Promise.all([
    import('@/components/QuotePDF'),
    fetchCompany(),
  ])
  await dl(quote, company)
}

const downloadQuoteXLSX = async (quote: Quote) => {
  const [{ downloadQuoteXLSX: dl }, company] = await Promise.all([
    import('@/components/QuoteXLSX'),
    fetchCompany(),
  ])
  dl(quote, company)
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (ms: number | null) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

const toDateStr = (ms: number | null) => ms ? new Date(ms).toISOString().slice(0, 10) : ''

const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '—'

function diffDays(ms: number): number {
  return Math.ceil((ms - Date.now()) / 86400000)
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === '—') return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  )
}

// ─── Status Sheet ─────────────────────────────────────────────────────────────

function StatusSheet({ current, onSelect, onClose }: {
  current: string
  onSelect: (s: string, lyDo?: string) => void
  onClose: () => void
}) {
  const [lyDo, setLyDo] = useState('')
  const [pending, setPending] = useState('')

  const handleSelect = (s: string) => {
    if (s === 'Từ chối') { setPending(s); return }
    onSelect(s)
    onClose()
  }

  if (pending === 'Từ chối') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="bg-white rounded-t-3xl p-5 space-y-4">
          <div className="flex justify-center -mt-2 mb-2">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>
          <h2 className="text-base font-bold text-gray-800">Lý do từ chối</h2>
          <select value={lyDo} onChange={e => setLyDo(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400">
            <option value="">— Chọn lý do —</option>
            <option>Giá cao</option>
            <option>Không bám đuổi</option>
            <option>Giới thiệu trễ</option>
            <option>Khác</option>
          </select>
          <div className="flex gap-3">
            <button onClick={() => setPending('')}
              className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">
              Quay lại
            </button>
            <button onClick={() => { onSelect('Từ chối', lyDo); onClose() }}
              className="flex-1 bg-red-500 text-white font-medium py-3 rounded-xl text-sm">
              Xác nhận từ chối
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Cập nhật trạng thái</h2>
        </div>
        <div className="p-4 space-y-2 pb-8">
          {QUOTE_STATUSES.map(s => {
            const c = QUOTE_STATUS_COLORS[s]
            const active = current === s
            return (
              <button key={s} onClick={() => handleSelect(s)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all ${
                  active ? `${c.bg} ${c.text}` : 'text-gray-700 hover:bg-gray-50'
                }`}>
                <span className="text-sm font-medium">{s}</span>
                {active && <span className="text-xs">✓</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Follow-up Section ───────────────────────────────────────────────────────

function FollowUpSection({ quote, onUpdated }: { quote: Quote; onUpdated: (q: Quote) => void }) {
  const [editing, setEditing]   = useState(false)
  const [fuDate,  setFuDate]    = useState(toDateStr(quote.ngay_follow_up))
  const [fuResult, setFuResult] = useState(quote.ket_qua_follow_up)
  const [saving,  setSaving]    = useState(false)
  const [err,     setErr]       = useState('')

  const save = async () => {
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setErr('')
    try {
      const res = await fetch(`/api/lark/quotes/${quote.record_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngay_follow_up:    fuDate   ? new Date(fuDate).getTime() : null,
          ket_qua_follow_up: fuResult,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Lỗi lưu'); return }
      onUpdated(data.data)
      setEditing(false)
    } catch { setErr('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400">THEO DÕI & CHĂM SÓC</p>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-xl">
            {quote.ngay_follow_up ? 'Cập nhật' : 'Ghi nhận'}
          </button>
        )}
      </div>

      {/* Ngày gửi & kênh */}
      {(quote.ngay_gui_kh || quote.kenh_tiep_nhan) && (
        <div className="flex gap-4 mb-3 pb-3 border-b border-gray-50">
          {quote.ngay_gui_kh && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Ngày gửi KH</p>
              <p className="text-sm font-medium text-gray-700">{fmtDate(quote.ngay_gui_kh)}</p>
            </div>
          )}
          {quote.kenh_tiep_nhan && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Nguồn KH</p>
              <p className="text-sm font-medium text-gray-700">{quote.kenh_tiep_nhan}</p>
            </div>
          )}
        </div>
      )}

      {/* Follow-up info (read mode) */}
      {!editing && (
        <div className="space-y-2">
          {quote.ngay_follow_up ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400 text-xs w-28 flex-shrink-0">Ngày follow-up</span>
              <span className="text-gray-700 font-medium">{fmtDate(quote.ngay_follow_up)}</span>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Chưa đặt lịch follow-up</p>
          )}
          {quote.ket_qua_follow_up && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Kết quả</p>
              <p className="text-sm text-gray-700 leading-relaxed">{quote.ket_qua_follow_up}</p>
            </div>
          )}
        </div>
      )}

      {/* Follow-up edit form */}
      {editing && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">NGÀY FOLLOW-UP</label>
            <input type="date" value={fuDate} onChange={e => setFuDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">KẾT QUẢ FOLLOW-UP</label>
            <textarea rows={3} value={fuResult} onChange={e => setFuResult(e.target.value)}
              placeholder="KH quan tâm, cần hỏi thêm giá, đã gửi brochure..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)}
              className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm">
              Huỷ
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 bg-blue-600 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl text-sm">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Edit Items Sheet ─────────────────────────────────────────────────────────

function EditItemsSheet({ quote, onClose, onSaved }: {
  quote: Quote
  onClose: () => void
  onSaved: (q: Quote) => void
}) {
  const DRAFT_KEY = `quote_edit_${quote.record_id}`
  const { items, total, addItem, addBlank, removeItem, changeItem, clear } = useQuoteItems(DRAFT_KEY)
  const [products,   setProducts]   = useState<Product[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [chietKhau,  setChietKhau]  = useState(String(quote.chiet_khau))
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  // Seed items từ BG hiện tại nếu draft trống
  useEffect(() => {
    if (items.length === 0 && quote.san_pham.length > 0) {
      quote.san_pham.forEach(sp => {
        // Parse "Tên SP (2x)" nếu có
        const match = sp.match(/^(.*?)\s*\((\d+)x\)$/)
        if (match) {
          addItem({ ten_sp: match[1].trim(), don_gia: 0 })
          changeItem('__placeholder__', 'so_luong', Number(match[2]))
        } else {
          addItem({ ten_sp: sp, don_gia: 0 })
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ck      = Number(chietKhau) || 0
  const afterCK = Math.round(total * (1 - ck / 100))
  const fmtM    = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '0₫'

  const loadProducts = () => {
    if (products.length > 0) { setShowPicker(true); return }
    fetch('/api/lark/products').then(r => r.json()).then(d => { setProducts(d.data ?? []); setShowPicker(true) })
  }

  const save = async () => {
    if (items.length === 0) { setError('Vui lòng thêm ít nhất 1 sản phẩm'); return }
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError('')
    try {
      const { san_pham } = itemsToLarkFields(items)
      const res = await fetch(`/api/lark/quotes/${quote.record_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ san_pham, tong_gia_tri: total, chiet_khau: ck }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi lưu'); return }
      clear()
      onSaved(data.data)
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
                className="w-full px-4 py-3.5 border-b border-gray-50 text-left flex items-center gap-3 active:bg-blue-50">
                <ProductThumb p={p} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.ten_sp}</p>
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
        <div className="bg-white rounded-t-3xl max-h-[90vh] flex flex-col">
          <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-800">Chỉnh sửa sản phẩm</h2>
            <button onClick={onClose} className="text-gray-400 p-1">✕</button>
          </div>

          {error && (
            <div className="mx-5 mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium flex-shrink-0">{error}</div>
          )}

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">DANH SÁCH SẢN PHẨM</span>
              {items.length > 0 && <button onClick={clear} className="text-xs text-red-400 font-medium">Xoá tất cả</button>}
            </div>

            {items.map(item => (
              <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={item.ten_sp} onChange={e => changeItem(item.id, 'ten_sp', e.target.value)}
                    placeholder="Tên sản phẩm"
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 p-1.5 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
                    <button onClick={() => changeItem(item.id, 'so_luong', Math.max(1, item.so_luong - 1))} className="w-5 h-5 flex items-center justify-center text-gray-500">−</button>
                    <span className="text-sm font-semibold text-gray-700 w-5 text-center">{item.so_luong}</span>
                    <button onClick={() => changeItem(item.id, 'so_luong', item.so_luong + 1)} className="w-5 h-5 flex items-center justify-center text-gray-500">+</button>
                  </div>
                  <span className="text-gray-300 text-sm">×</span>
                  <input type="number" value={item.don_gia || ''}
                    onChange={e => changeItem(item.id, 'don_gia', Number(e.target.value) || 0)}
                    placeholder="Đơn giá"
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <span className="text-xs font-semibold text-blue-600 min-w-[72px] text-right">
                    {fmtM(item.so_luong * item.don_gia)}
                  </span>
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <button onClick={loadProducts} className="flex-1 border-2 border-dashed border-blue-200 rounded-xl py-2.5 text-xs text-blue-600 font-semibold">+ Từ danh mục</button>
              <button onClick={addBlank} className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-xs text-gray-500 font-semibold">+ Nhập thủ công</button>
            </div>

            {items.length > 0 && (
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">{items.length} sản phẩm</span>
                <span className="text-sm font-bold text-gray-800">{fmtM(total)}</span>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-gray-600 mb-1 block">CHIẾT KHẤU TỔNG (%)</label>
              <input type="number" value={chietKhau} onChange={e => setChietKhau(e.target.value)} placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {total > 0 && ck > 0 && (
              <div className="bg-green-50 rounded-xl px-4 py-3 flex justify-between">
                <span className="text-xs text-gray-500">Giá sau chiết khấu</span>
                <span className="text-sm font-bold text-green-600">{fmtM(afterCK)}</span>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 sheet-safe">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">Huỷ</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl text-sm">
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuoteDetailPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }

  const [quote,       setQuote]       = useState<Quote | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [showStatus,  setShowStatus]  = useState(false)
  const [showEdit,    setShowEdit]    = useState(false)
  const [updating,    setUpdating]    = useState(false)
  const [duplicating,   setDuplicating]   = useState(false)
  const [exportingPDF,  setExportingPDF]  = useState(false)
  const [successMsg,    setSuccessMsg]    = useState('')
  const [errorMsg,      setErrorMsg]      = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/lark/quotes/${id}`)
      .then(r => r.json())
      .then(d => setQuote(d.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const notify = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg); else setSuccessMsg(msg)
    setTimeout(() => { setSuccessMsg(''); setErrorMsg('') }, 3000)
  }

  // Cập nhật trạng thái
  const handleStatusChange = async (newStatus: string, lyDo?: string) => {
    setUpdating(true)
    try {
      const body: Record<string, unknown> = { trang_thai: newStatus }
      if (lyDo) body.ly_do_tu_choi = lyDo
      const res = await fetch(`/api/lark/quotes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.error || 'Lỗi cập nhật', true); return }
      setQuote(data.data)
      notify('Đã cập nhật trạng thái')
    } catch { notify('Lỗi kết nối', true) }
    finally { setUpdating(false) }
  }

  // Tạo version mới (duplicate + tăng phiên bản)
  const handleDuplicate = async () => {
    if (!quote) return
    setDuplicating(true)
    try {
      const res = await fetch('/api/lark/quotes/duplicate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_record_id: quote.record_id }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.error || 'Lỗi tạo version mới', true); return }
      notify(`Đã tạo ${data.data.ma_bao_gia} — v${data.data.phien_ban}`)
      // Chuyển sang BG mới
      setTimeout(() => router.replace(`/dashboard/orders/quote/${data.data.record_id}`), 1200)
    } catch { notify('Lỗi kết nối', true) }
    finally { setDuplicating(false) }
  }

  // Chuyển thành HĐ
  const handleCreateContract = () => {
    if (!quote) return
    // Pre-fill form tạo HĐ với dữ liệu từ BG
    const params = new URLSearchParams({
      from_quote: quote.record_id,
      khach_hang: quote.khach_hang,
      sdt:        quote.sdt,
      gia_tri:    String(quote.gia_tri_sau_ck || quote.tong_gia_tri),
    })
    router.push(`/dashboard/orders?tab=b2c&${params.toString()}`)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <span className="crm-spinner" />
    </div>
  )

  if (!quote) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 text-sm">Không tìm thấy báo giá</p>
      <button onClick={() => router.back()} className="text-blue-600 text-sm font-semibold">← Quay lại</button>
    </div>
  )

  const now          = Date.now()
  const isExpired    = quote.ngay_het_han ? now > quote.ngay_het_han : false
  const daysLeft     = quote.ngay_het_han ? diffDays(quote.ngay_het_han) : null
  const displayStatus = (isExpired && !['Chấp nhận','Từ chối'].includes(quote.trang_thai)) ? 'Hết hạn' : quote.trang_thai
  const statusColor  = QUOTE_STATUS_COLORS[displayStatus] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
  const canEdit      = !['Chấp nhận', 'Từ chối'].includes(quote.trang_thai)

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
          <h1 className="text-base font-bold text-gray-800 truncate">{quote.ma_bao_gia}</h1>
          <p className="text-xs text-gray-400">{quote.khach_hang} · v{quote.phien_ban}</p>
        </div>
        {successMsg && <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>}
        {errorMsg   && <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded-lg">{errorMsg}</span>}
      </div>

      <div className="p-4 space-y-4">

        {/* Status card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">TRẠNG THÁI BÁO GIÁ</p>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-xl ${statusColor.bg} ${statusColor.text}`}>
              {displayStatus}
            </span>
            {canEdit && (
              <button onClick={() => setShowStatus(true)} disabled={updating}
                className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-xl">
                {updating ? 'Đang lưu...' : 'Cập nhật'}
              </button>
            )}
          </div>

          {/* Deadline warning */}
          {daysLeft !== null && !['Chấp nhận','Từ chối'].includes(quote.trang_thai) && (
            <div className={`mt-3 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl ${
              isExpired ? 'bg-red-50 text-red-600' :
              daysLeft <= 3 ? 'bg-orange-50 text-orange-600' :
              'bg-gray-50 text-gray-500'
            }`}>
              <span>{isExpired ? '⚠️' : daysLeft <= 3 ? '⏰' : '📅'}</span>
              <span>
                {isExpired
                  ? `Đã hết hạn ${Math.abs(daysLeft)} ngày trước`
                  : `Còn ${daysLeft} ngày (HH: ${fmtDate(quote.ngay_het_han)})`}
              </span>
            </div>
          )}
        </div>

        {/* Price summary card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">GIÁ TRỊ BÁO GIÁ</p>
          <div className="space-y-2">
            {quote.san_pham.map((sp, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1">{sp}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tổng giá trị</span>
              <span className="font-medium text-gray-800">{fmtMoney(quote.tong_gia_tri)}</span>
            </div>
            {quote.chiet_khau > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Chiết khấu</span>
                <span className="font-medium text-orange-500">−{quote.chiet_khau}%</span>
              </div>
            )}
            <div className="flex justify-between text-base pt-1 border-t border-gray-100">
              <span className="font-semibold text-gray-700">Thành tiền</span>
              <span className="font-bold text-blue-600">{fmtMoney(quote.gia_tri_sau_ck || quote.tong_gia_tri)}</span>
            </div>
          </div>

          {canEdit && (
            <button onClick={() => setShowEdit(true)}
              className="mt-3 w-full border border-blue-200 text-blue-600 text-xs font-semibold py-2 rounded-xl bg-blue-50">
              Chỉnh sửa sản phẩm & giá
            </button>
          )}
        </div>

        {/* Info card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">THÔNG TIN BÁO GIÁ</p>
          <InfoRow label="Mã báo giá"     value={quote.ma_bao_gia} />
          <InfoRow label="Khách hàng"     value={quote.khach_hang} />
          <InfoRow label="Số điện thoại"  value={quote.sdt} />
          <InfoRow label="Người phụ trách" value={quote.nguoi_phu_trach} />
          <InfoRow label="Phiên bản"      value={`v${quote.phien_ban}`} />
          <InfoRow label="Ngày lập"       value={fmtDate(quote.ngay_lap)} />
          <InfoRow label="Ngày hết hạn"   value={fmtDate(quote.ngay_het_han)} />
          {quote.ma_hd_tham_chieu && (
            <InfoRow label="Mã HĐ tham chiếu" value={quote.ma_hd_tham_chieu} />
          )}
        </div>

        {/* Notes */}
        {(quote.ghi_chu_ky_thuat || quote.ghi_chu_thuong_mai) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 mb-3">GHI CHÚ</p>
            {quote.ghi_chu_ky_thuat && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-1">Kỹ thuật</p>
                <p className="text-sm text-gray-700 leading-relaxed">{quote.ghi_chu_ky_thuat}</p>
              </div>
            )}
            {quote.ghi_chu_thuong_mai && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Thương mại</p>
                <p className="text-sm text-gray-700 leading-relaxed">{quote.ghi_chu_thuong_mai}</p>
              </div>
            )}
          </div>
        )}

        {/* Follow-up */}
        <FollowUpSection quote={quote} onUpdated={setQuote} />

        {/* Từ chối */}
        {quote.ly_do_tu_choi && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <p className="text-xs font-semibold text-red-400 mb-2">LÝ DO TỪ CHỐI</p>
            <p className="text-sm text-red-700 leading-relaxed">{quote.ly_do_tu_choi}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2 pb-6">
          {/* Xuất PDF */}
          <button
            onClick={async () => {
              setExportingPDF(true)
              try { await downloadQuotePDF(quote) }
              catch { notify('Lỗi xuất PDF', true) }
              finally { setExportingPDF(false) }
            }}
            disabled={exportingPDF}
            className="w-full bg-blue-600 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-sm active:bg-blue-700">
            <span>📄</span>
            {exportingPDF ? 'Đang tạo PDF...' : 'Xuất PDF báo giá'}
          </button>

          {/* Xuất XLSX */}
          <button
            onClick={() => { downloadQuoteXLSX(quote) }}
            className="w-full bg-white border border-gray-200 text-green-700 font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-sm active:bg-gray-50">
            <span>📊</span> Xuất XLSX
          </button>

          {/* Tạo version mới */}
          <button onClick={handleDuplicate} disabled={duplicating}
            className="w-full bg-white border border-gray-200 text-gray-700 font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-sm active:bg-gray-50">
            <span>📋</span>
            {duplicating ? 'Đang tạo...' : `Tạo version mới (v${quote.phien_ban + 1})`}
          </button>

          {/* Chuyển thành HĐ — chỉ khi Chấp nhận */}
          {quote.trang_thai === 'Chấp nhận' && (
            <button onClick={handleCreateContract}
              className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-sm active:bg-green-700">
              <span>✅</span> Chuyển thành Hợp đồng
            </button>
          )}
        </div>
      </div>

      {showStatus && (
        <StatusSheet
          current={displayStatus}
          onSelect={handleStatusChange}
          onClose={() => setShowStatus(false)}
        />
      )}

      {showEdit && (
        <EditItemsSheet
          quote={quote}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { setQuote(updated); setShowEdit(false); notify('Đã lưu thay đổi') }}
        />
      )}
    </div>
  )
}
