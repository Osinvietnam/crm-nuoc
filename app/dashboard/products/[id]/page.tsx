'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Product } from '@/app/api/lark/products/_mapper'

const fmtMoney = (n: number) => n > 0 ? n.toLocaleString('vi-VN') + '₫' : '—'

function productImageUrl(recordId: string, bust?: number) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/product-images/${recordId}${bust ? `?t=${bust}` : ''}`
}

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
  const [bust, setBust]         = useState(0)
  const [hasImg, setHasImg]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [showDel, setShowDel]   = useState(false)

  // Try loading image on mount to know if it exists
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
      setHasImg(false)
      setBust(0)
      setShowDel(false)
    } catch {}
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Image area */}
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
                <button
                  onClick={() => fileRef.current?.click()}
                  className="bg-white/90 backdrop-blur text-xs font-semibold text-gray-700 px-3 py-1.5 rounded-xl shadow"
                >
                  Đổi ảnh
                </button>
                <button
                  onClick={() => setShowDel(true)}
                  className="bg-red-500/90 backdrop-blur text-xs font-semibold text-white px-3 py-1.5 rounded-xl shadow"
                >
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
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold mt-1"
              >
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

      {uploadErr && (
        <p className="text-xs text-red-600 px-4 py-2">{uploadErr}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) upload(f)
          e.target.value = ''
        }}
      />

      {/* Delete confirm */}
      {showDel && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-600">Xóa ảnh này?</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDel(false)}
              className="text-xs text-gray-500 px-3 py-1.5 rounded-lg bg-gray-100">
              Hủy
            </button>
            <button onClick={deleteImg}
              className="text-xs text-white px-3 py-1.5 rounded-lg bg-red-500">
              Xóa
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [product, setProduct]   = useState<Product | null>(null)
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [isAdmin, setIsAdmin]   = useState(false)

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
            gia_niem_yet:   p.gia_niem_yet > 0 ? String(p.gia_niem_yet) : '',
            gia_chiet_khau: p.gia_chiet_khau > 0 ? String(p.gia_chiet_khau) : '',
            gia_dai_ly:     p.gia_dai_ly > 0 ? String(p.gia_dai_ly) : '',
            gia_npp:        p.gia_npp > 0 ? String(p.gia_npp) : '',
            hh_kd:          p.hh_kd > 0 ? String(p.hh_kd) : '',
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
    setSaving(true)
    try {
      const res = await fetch(`/api/lark/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ten_sp:         form.ten_sp,
          ma_sp:          form.ma_sp,
          phan_loai:      form.phan_loai,
          nhom_sp:        form.nhom_sp,
          gia_niem_yet:   Number(form.gia_niem_yet) || 0,
          gia_chiet_khau: Number(form.gia_chiet_khau) || 0,
          gia_dai_ly:     Number(form.gia_dai_ly) || 0,
          gia_npp:        Number(form.gia_npp) || 0,
          hh_kd:          Number(form.hh_kd) || 0,
          mo_ta:          form.mo_ta,
        }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setProduct(d.data)
      setEditing(false)
      setSuccessMsg('Đã lưu')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch {} finally { setSaving(false) }
  }

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
          <p className="text-xs text-gray-400">{product.ma_sp}</p>
        </div>
        {successMsg && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>}
        {isAdmin && !editing && (
          <button onClick={() => setEditing(true)}
            className="text-sm text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-xl">
            Sửa
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Product Image — always visible */}
        <ProductImage recordId={id} isAdmin={isAdmin} />

        {!editing ? (
          <>
            {/* Prices */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400">Hoa hồng kinh doanh</p>
                  <p className="text-sm font-semibold text-purple-600">{product.hh_kd}%</p>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 mb-3">THÔNG TIN SẢN PHẨM</p>
              <InfoRow label="Tên sản phẩm" value={product.ten_sp} />
              <InfoRow label="Mã SP" value={product.ma_sp} />
              <InfoRow label="Phân loại" value={product.phan_loai} />
              <InfoRow label="Nhóm SP" value={product.nhom_sp} />
              {product.mo_ta && <InfoRow label="Mô tả" value={product.mo_ta} />}
              {product.updated_at && (
                <InfoRow
                  label="Cập nhật lần cuối"
                  value={new Date(product.updated_at).toLocaleString('vi-VN', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                />
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <p className="text-xs font-semibold text-gray-400">CHỈNH SỬA SẢN PHẨM</p>
            <Field label="TÊN SẢN PHẨM" value={form.ten_sp} onChange={v => set('ten_sp', v)} placeholder="Tên sản phẩm" />
            <Field label="MÃ SP" value={form.ma_sp} onChange={v => set('ma_sp', v)} placeholder="SP001" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="PHÂN LOẠI" value={form.phan_loai} onChange={v => set('phan_loai', v)} />
              <Field label="NHÓM SP" value={form.nhom_sp} onChange={v => set('nhom_sp', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GIÁ NIÊM YẾT" value={form.gia_niem_yet} onChange={v => set('gia_niem_yet', v)} type="number" />
              <Field label="GIÁ CHIẾT KHẤU" value={form.gia_chiet_khau} onChange={v => set('gia_chiet_khau', v)} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GIÁ ĐẠI LÝ" value={form.gia_dai_ly} onChange={v => set('gia_dai_ly', v)} type="number" />
              <Field label="GIÁ NPP" value={form.gia_npp} onChange={v => set('gia_npp', v)} type="number" />
            </div>
            <Field label="% HOA HỒNG KD" value={form.hh_kd} onChange={v => set('hh_kd', v)} type="number" />
            <TextArea label="MÔ TẢ" value={form.mo_ta} onChange={v => set('mo_ta', v)} />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => setEditing(false)}
                className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">
                Hủy
              </button>
              <button onClick={save} disabled={saving}
                className="py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60">
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
