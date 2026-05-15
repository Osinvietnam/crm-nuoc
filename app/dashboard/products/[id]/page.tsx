'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Product } from '@/app/api/lark/products/_mapper'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => n > 0 ? n.toLocaleString('vi-VN') + '₫' : '—'

function productImageUrl(recordId: string, bust?: number) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/product-images/${recordId}${bust ? `?t=${bust}` : ''}`
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === '—' || value === '0₫') return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  )
}

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

// ─── Product Image Block ───────────────────────────────────────────────────────

function ProductImage({ recordId, isAdmin }: { recordId: string; isAdmin: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [bust, setBust]           = useState(0)
  const [hasImg, setHasImg]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [showDel, setShowDel]     = useState(false)

  useEffect(() => {
    const img = new Image()
    img.onload  = () => setHasImg(true)
    img.onerror = () => setHasImg(false)
    img.src = productImageUrl(recordId)
  }, [recordId])

  const upload = async (file: File) => {
    setUploading(true); setUploadErr('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`/api/lark/products/${recordId}/image`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setUploadErr(data.error || 'Lỗi upload'); return }
      setBust(Date.now())
      setHasImg(true)
    } catch { setUploadErr('Lỗi kết nối') }
    finally { setUploading(false) }
  }

  const deleteImg = async () => {
    try {
      await fetch(`/api/lark/products/${recordId}/image`, { method: 'DELETE' })
      setHasImg(false); setBust(0); setShowDel(false)
    } catch {}
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="relative">
        {hasImg ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImageUrl(recordId, bust || undefined)}
              alt="Ảnh sản phẩm"
              className="w-full max-h-72 object-contain bg-gray-50"
              onError={() => setHasImg(false)}
            />
            {isAdmin && (
              <div className="absolute top-2 right-2 flex gap-2">
                <button onClick={() => fileRef.current?.click()}
                  className="bg-white/90 backdrop-blur text-xs font-semibold text-gray-700 px-3 py-1.5 rounded-xl shadow">
                  Đổi ảnh
                </button>
                <button onClick={() => setShowDel(true)}
                  className="bg-red-500/90 backdrop-blur text-xs font-semibold text-white px-3 py-1.5 rounded-xl shadow">
                  Xóa
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-40 bg-gray-50 flex flex-col items-center justify-center gap-2">
            <span className="text-4xl opacity-30">📦</span>
            <p className="text-xs text-gray-400">Chưa có ảnh sản phẩm</p>
            {isAdmin && (
              <button onClick={() => fileRef.current?.click()}
                className="text-xs bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold mt-1">
                + Tải ảnh lên
              </button>
            )}
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <p className="text-sm font-semibold text-blue-600">Đang tải lên...</p>
          </div>
        )}
      </div>
      {uploadErr && <p className="text-xs text-red-600 px-4 py-2">{uploadErr}</p>}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
      {showDel && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-600">Xóa ảnh này?</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDel(false)}
              className="text-xs text-gray-500 px-3 py-1.5 rounded-lg bg-gray-100">Hủy</button>
            <button onClick={deleteImg}
              className="text-xs text-white px-3 py-1.5 rounded-lg bg-red-500">Xóa</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Components ────────────────────────────────────────────────────────────

function PriceHistoryTab({ productId }: { productId: string }) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/lark/products/${productId}/price-history`)
      .then(r => r.json())
      .then(d => setHistory(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [productId])

  const LABEL: Record<string, string> = {
    niem_yet: 'Niêm yết', chiet_khau: 'Chiết khấu',
    dai_ly: 'Đại lý', npp: 'NPP', hh_kd: 'Hoa hồng',
  }

  if (loading) return <div className="flex justify-center py-12"><span className="crm-spinner" /></div>
  if (history.length === 0) return (
    <div className="flex flex-col items-center py-12 gap-2 text-center">
      <span className="text-3xl">📈</span>
      <p className="text-sm text-gray-500">Chưa có thay đổi giá nào được ghi lại</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {history.map((h: any) => (
        <div key={h.id} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-600">{LABEL[h.loai_gia] ?? h.loai_gia}</span>
            <span className="text-[10px] text-gray-400">
              {new Date(h.changed_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 line-through">{fmtMoney(h.gia_cu)}</span>
            <span className="text-gray-300">→</span>
            <span className="text-sm font-bold text-gray-800">{fmtMoney(h.gia_moi)}</span>
            {h.pct_change !== null && h.pct_change !== undefined && (
              <span className={`text-xs font-semibold ml-auto ${h.pct_change > 0 ? 'text-red-500' : 'text-green-600'}`}>
                {h.pct_change > 0 ? '▲' : '▼'} {Math.abs(h.pct_change)}%
              </span>
            )}
          </div>
          {h.changed_by_name && <p className="text-[10px] text-gray-400 mt-1">bởi {h.changed_by_name}</p>}
        </div>
      ))}
    </div>
  )
}

function DocumentsTab({ productId, isAdmin }: { productId: string; isAdmin: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [loai, setLoai]         = useState('catalogue')

  useEffect(() => {
    fetch(`/api/lark/products/${productId}/documents`)
      .then(r => r.json())
      .then(d => setDocs(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [productId])

  const upload = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('loai', loai)
    fd.append('ten_file', file.name)
    try {
      const res = await fetch(`/api/lark/products/${productId}/documents`, { method: 'POST', body: fd })
      if (res.ok) {
        const d = await res.json()
        setDocs(prev => [d.data, ...prev])
      }
    } catch {}
    finally { setUploading(false) }
  }

  const deleteDoc = async (docId: number) => {
    await fetch(`/api/lark/products/${productId}/documents/${docId}`, { method: 'DELETE' })
    setDocs(prev => prev.filter((d: any) => d.id !== docId))
  }

  const ICON: Record<string, string> = {
    catalogue: '📋', spec: '📐', manual: '📖', certificate: '🏆', other: '📎',
  }
  const fmtSize = (n: number) => n > 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`

  if (loading) return <div className="flex justify-center py-12"><span className="crm-spinner" /></div>

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="bg-blue-50 rounded-2xl p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-700">Tải tài liệu lên</p>
          <div className="flex gap-2">
            <select value={loai} onChange={e => setLoai(e.target.value)}
              className="flex-1 text-xs border border-blue-200 rounded-xl px-2 py-1.5 bg-white">
              <option value="catalogue">📋 Catalogue</option>
              <option value="spec">📐 Thông số KT</option>
              <option value="manual">📖 Hướng dẫn</option>
              <option value="certificate">🏆 Chứng chỉ</option>
              <option value="other">📎 Khác</option>
            </select>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-xl font-semibold disabled:opacity-50">
              {uploading ? '...' : '+ Tải lên'}
            </button>
          </div>
          <input ref={fileRef} type="file" className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
        </div>
      )}

      {docs.length === 0 && (
        <div className="flex flex-col items-center py-12 gap-2">
          <span className="text-3xl">📄</span>
          <p className="text-sm text-gray-500">Chưa có tài liệu nào</p>
        </div>
      )}

      {docs.map((doc: any) => (
        <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm flex items-center gap-3">
          <span className="text-2xl">{ICON[doc.loai] ?? '📎'}</span>
          <div className="flex-1 min-w-0">
            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline truncate block">{doc.ten_file}</a>
            <p className="text-[10px] text-gray-400">
              {fmtSize(doc.file_size ?? 0)} · {new Date(doc.created_at).toLocaleDateString('vi-VN')}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => deleteDoc(doc.id)}
              className="text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-red-50">Xóa</button>
          )}
        </div>
      ))}
    </div>
  )
}

function FeedbackTab({ productId }: { productId: string }) {
  const [data, setData] = useState<{ avg_rating: number | null; count: number; data: any[] }>({
    avg_rating: null, count: 0, data: [],
  })
  const [loading, setLoading] = useState(true)
  const [myRating, setMyRating] = useState(0)
  const [myNote, setMyNote]     = useState('')
  const [saving, setSaving]     = useState(false)

  const load = () => {
    fetch(`/api/lark/products/${productId}/feedback`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [productId]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!myRating) return
    setSaving(true)
    try {
      await fetch(`/api/lark/products/${productId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: myRating, noi_dung: myNote, nguon: 'manual' }),
      })
      setMyRating(0); setMyNote('')
      load()
    } catch {}
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-12"><span className="crm-spinner" /></div>

  return (
    <div className="space-y-4">
      {data.count > 0 && (
        <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-700">{data.avg_rating?.toFixed(1)}</p>
            <p className="text-xs text-blue-500">/5 sao</p>
          </div>
          <div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <span key={s} className={`text-xl ${s <= Math.round(data.avg_rating ?? 0) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{data.count} đánh giá nội bộ</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <p className="text-xs font-semibold text-gray-600">Đánh giá của bạn</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} onClick={() => setMyRating(s)}
              className={`text-2xl ${s <= myRating ? 'text-yellow-400' : 'text-gray-200'}`}>★</button>
          ))}
        </div>
        <textarea value={myNote} onChange={e => setMyNote(e.target.value)} rows={2}
          placeholder="Nhận xét về chất lượng, lỗi phổ biến..."
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-blue-400" />
        <button onClick={submit} disabled={!myRating || saving}
          className="w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {saving ? 'Đang gửi...' : 'Gửi đánh giá'}
        </button>
      </div>

      {data.data.map((f: any) => (
        <div key={f.id} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <span key={s} className={`text-sm ${s <= f.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
              ))}
            </div>
            <span className="text-xs text-gray-500">{f.user_name ?? 'Ẩn danh'}</span>
            <span className="text-[10px] text-gray-400 ml-auto">{new Date(f.created_at).toLocaleDateString('vi-VN')}</span>
          </div>
          {f.noi_dung && <p className="text-sm text-gray-600">{f.noi_dung}</p>}
        </div>
      ))}
    </div>
  )
}

function QRTab({ productId, productName }: { productId: string; productName: string }) {
  const [qr, setQr] = useState<{ qr_url: string; product_url: string } | null>(null)

  useEffect(() => {
    fetch(`/api/lark/products/${productId}/qr`)
      .then(r => r.json())
      .then(d => setQr(d))
      .catch(() => {})
  }, [productId])

  return (
    <div className="flex flex-col items-center py-6 gap-4">
      {qr ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.qr_url} alt="QR Code"
            className="w-48 h-48 border border-gray-200 rounded-2xl p-2 bg-white" />
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">{productName}</p>
            <p className="text-xs text-gray-400 mt-0.5 break-all">{qr.product_url}</p>
          </div>
          <div className="flex gap-2">
            <a href={qr.qr_url} download={`qr_${productId}.png`} target="_blank" rel="noopener noreferrer"
              className="text-xs bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold">
              ↓ Tải QR PNG
            </a>
            <button onClick={() => navigator.clipboard.writeText(qr.product_url)}
              className="text-xs bg-gray-100 text-gray-600 px-4 py-2 rounded-xl font-semibold">
              Copy link
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Dán QR lên tem thiết bị để KTV tra cứu nhanh ngoài hiện trường
          </p>
        </>
      ) : (
        <div className="flex justify-center py-12"><span className="crm-spinner" /></div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type TabId = 'info' | 'gia' | 'lich_su' | 'tai_lieu' | 'phan_hoi' | 'qr'

export default function ProductDetailPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [product, setProduct]     = useState<Product | null>(null)
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')     // FIX A3
  const [successMsg, setSuccessMsg] = useState('')
  const [isAdmin, setIsAdmin]     = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('info')

  const [form, setForm] = useState({
    ten_sp: '', ma_sp: '', phan_loai: '', nhom_sp: '',
    gia_niem_yet: '', gia_chiet_khau: '', gia_dai_ly: '', gia_npp: '',
    hh_kd: '', mo_ta: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch(`/api/lark/products/${id}`)
      .then(r => r.json())
      .then(d => {
        setProduct(d.data)
        if (d.data) {
          const p: Product = d.data
          setForm({
            ten_sp:         p.ten_sp,
            ma_sp:          p.ma_sp,
            phan_loai:      p.phan_loai,
            nhom_sp:        p.nhom_sp,
            gia_niem_yet:   p.gia_niem_yet   > 0 ? String(p.gia_niem_yet)   : '',
            gia_chiet_khau: p.gia_chiet_khau > 0 ? String(p.gia_chiet_khau) : '',
            gia_dai_ly:     p.gia_dai_ly     > 0 ? String(p.gia_dai_ly)     : '',
            gia_npp:        p.gia_npp        > 0 ? String(p.gia_npp)        : '',
            hh_kd:          p.hh_kd          > 0 ? String(p.hh_kd)          : '',
            mo_ta:          p.mo_ta,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch('/api/auth/me').then(r => r.json())
      .then(d => { if (['admin', 'ceo', 'director'].includes(d?.role)) setIsAdmin(true) })
      .catch(() => {})
  }, [id])

  const save = async () => {
    setSaving(true); setSaveError('')   // FIX A3
    try {
      const res = await fetch(`/api/lark/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ten_sp:         form.ten_sp,
          ma_sp:          form.ma_sp,
          phan_loai:      form.phan_loai,
          nhom_sp:        form.nhom_sp,
          gia_niem_yet:   Number(form.gia_niem_yet)   || 0,
          gia_chiet_khau: Number(form.gia_chiet_khau) || 0,
          gia_dai_ly:     Number(form.gia_dai_ly)     || 0,
          gia_npp:        Number(form.gia_npp)        || 0,
          hh_kd:          Number(form.hh_kd)          || 0,
          mo_ta:          form.mo_ta,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setSaveError(d.error ?? 'Lưu thất bại'); return }   // FIX A3
      setProduct(d.data)
      setEditing(false)
      setSuccessMsg('Đã lưu')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch {
      setSaveError('Lỗi kết nối, vui lòng thử lại')   // FIX A3
    } finally {
      setSaving(false)
    }
  }

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'info',     label: 'Thông tin',   icon: '📋' },
    { id: 'gia',      label: 'Bảng giá',    icon: '💰' },
    { id: 'lich_su',  label: 'Lịch sử giá', icon: '📈' },
    { id: 'tai_lieu', label: 'Tài liệu',    icon: '📄' },
    { id: 'phan_hoi', label: 'Phản hồi',    icon: '⭐' },
    { id: 'qr',       label: 'QR Code',     icon: '📱' },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <span className="crm-spinner" />
    </div>
  )
  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 text-sm">Không tìm thấy sản phẩm</p>
      <button onClick={() => router.back()} className="text-blue-600 text-sm font-semibold">← Quay lại</button>
    </div>
  )

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
          <h1 className="text-base font-bold text-gray-800 truncate">{product.ten_sp}</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-400">{product.ma_sp}</p>
            {product.con_hang === false && (
              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Hết hàng</span>
            )}
          </div>
        </div>
        {successMsg && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>
        )}
        {isAdmin && !editing && (
          <button onClick={() => setEditing(true)}
            className="text-sm text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-xl">
            Sửa
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 px-4">
        <div className="flex overflow-x-auto scrollbar-none gap-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ProductImage — luôn hiện ở tất cả tabs */}
        <ProductImage recordId={id} isAdmin={isAdmin} />

        {/* TAB: Info — view */}
        {activeTab === 'info' && !editing && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 mb-3">THÔNG TIN SẢN PHẨM</p>
            <InfoRow label="Tên sản phẩm" value={product.ten_sp} />
            <InfoRow label="Mã SP" value={product.ma_sp} />
            <InfoRow label="Phân loại" value={product.phan_loai} />
            <InfoRow label="Nhóm SP" value={product.nhom_sp} />
            {product.mo_ta && <InfoRow label="Mô tả" value={product.mo_ta} />}
            {(product as any).loai_sp && <InfoRow label="Loại SP" value={(product as any).loai_sp} />}
            {(product as any).chu_ky_thay_the > 0 && (
              <InfoRow label="Thay thế định kỳ" value={`${(product as any).chu_ky_thay_the} tháng`} />
            )}
            {product.updated_at && (
              <InfoRow label="Cập nhật lần cuối"
                value={new Date(product.updated_at).toLocaleString('vi-VN', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })} />
            )}
          </div>
        )}

        {/* TAB: Info — editing */}
        {activeTab === 'info' && editing && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <p className="text-xs font-semibold text-gray-400">CHỈNH SỬA SẢN PHẨM</p>
            <Field label="TÊN SẢN PHẨM" value={form.ten_sp} onChange={v => set('ten_sp', v)} placeholder="Tên sản phẩm" />
            <Field label="MÃ SP" value={form.ma_sp} onChange={v => set('ma_sp', v)} placeholder="SP001" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="PHÂN LOẠI" value={form.phan_loai} onChange={v => set('phan_loai', v)} />
              <Field label="NHÓM SP" value={form.nhom_sp} onChange={v => set('nhom_sp', v)} />
            </div>
            <TextArea label="MÔ TẢ" value={form.mo_ta} onChange={v => set('mo_ta', v)} />
            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{saveError}</p>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => { setEditing(false); setSaveError('') }}
                className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">Hủy</button>
              <button onClick={save} disabled={saving}
                className="py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60">
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        )}

        {/* TAB: Giá */}
        {activeTab === 'gia' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">BẢNG GIÁ</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400">Niêm yết</p>
                <p className="text-lg font-bold text-gray-800">{fmtMoney(product.gia_niem_yet)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Chiết khấu</p>
                <p className="text-lg font-bold text-blue-600">{fmtMoney(product.gia_chiet_khau)}</p>
              </div>
              {isAdmin && (
                <>
                  <div>
                    <p className="text-xs text-gray-400">Đại lý</p>
                    <p className="text-base font-semibold text-green-600">{fmtMoney(product.gia_dai_ly)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">NPP</p>
                    <p className="text-base font-semibold text-orange-600">{fmtMoney(product.gia_npp)}</p>
                  </div>
                </>
              )}
            </div>
            {product.hh_kd > 0 && (
              <div className="pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400">Hoa hồng kinh doanh</p>
                <p className="text-sm font-semibold text-purple-600">{product.hh_kd}%</p>
              </div>
            )}
            {editing && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400">CHỈNH SỬA GIÁ</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="GIÁ NIÊM YẾT" value={form.gia_niem_yet} onChange={v => set('gia_niem_yet', v)} type="number" />
                  <Field label="GIÁ CHIẾT KHẤU" value={form.gia_chiet_khau} onChange={v => set('gia_chiet_khau', v)} type="number" />
                  <Field label="GIÁ ĐẠI LÝ" value={form.gia_dai_ly} onChange={v => set('gia_dai_ly', v)} type="number" />
                  <Field label="GIÁ NPP" value={form.gia_npp} onChange={v => set('gia_npp', v)} type="number" />
                </div>
                <Field label="% HOA HỒNG KD" value={form.hh_kd} onChange={v => set('hh_kd', v)} type="number" />
                {saveError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{saveError}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setEditing(false); setSaveError('') }}
                    className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">Hủy</button>
                  <button onClick={save} disabled={saving}
                    className="py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60">
                    {saving ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Lịch sử giá */}
        {activeTab === 'lich_su' && <PriceHistoryTab productId={id} />}

        {/* TAB: Tài liệu */}
        {activeTab === 'tai_lieu' && <DocumentsTab productId={id} isAdmin={isAdmin} />}

        {/* TAB: Phản hồi */}
        {activeTab === 'phan_hoi' && <FeedbackTab productId={id} />}

        {/* TAB: QR */}
        {activeTab === 'qr' && <QRTab productId={id} productName={product.ten_sp} />}
      </div>
    </div>
  )
}
