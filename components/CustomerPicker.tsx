'use client'

/**
 * CustomerPicker — shared component dùng ở BG / HĐ / Đơn TM / Dự án
 *
 * Props:
 *   onSelect(c)      — callback khi chọn hoặc tạo xong KH
 *   onClose()        — đóng picker
 *   allowCreate?     — cho phép tạo KH mới inline (default true)
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PIPELINE_STAGES,
  NGUON_KH_OPTIONS,
  LOAI_HINH_NHA_OPTIONS,
} from '@/lib/lark/tables'
import type { Customer } from '@/app/api/lark/customers/route'

// ─── Vietnamese normalization (for duplicate check) ───────────────────────────

function viNormalize(s: string): string {
  return s
    .toLowerCase()
    // Remove diacritics via NFD decomposition
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // đ → d (not covered by NFD)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    // Collapse whitespace
    .replace(/\s+/g, '')
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NHOM_DV_OPTIONS = [
  'BL1 — Lắp đặt trọn gói',
  'BL1 + BL3 — Lắp đặt + Định kỳ',
  'BL2 — Thương mại',
  'BL3 — Dịch vụ định kỳ',
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface NameDuplicate {
  id: number
  ho_ten: string
  sdt: string
  pipeline: string
}

interface CreateForm {
  ho_ten: string
  sdt: string
  email: string
  nguon_kh: string
  loai_kh: string
  khu_vuc: string
  loai_hinh_nha: string
  nhom_dv: string
  pipeline: string
}

// ─── Inline Create Form ───────────────────────────────────────────────────────

function InlineCreateForm({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string
  onCreated: (c: Customer) => void
  onCancel: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<CreateForm>({
    ho_ten: initialName,
    sdt: '',
    email: '',
    nguon_kh: '',
    loai_kh: 'B2C',
    khu_vuc: '',
    loai_hinh_nha: '',
    nhom_dv: '',
    pipeline: 'Lead mới',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicateId, setDuplicateId] = useState<number | null>(null)
  const [nameDuplicates, setNameDuplicates] = useState<NameDuplicate[]>([])

  const set = (k: keyof CreateForm, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  const checkNameDuplicates = async (name: string) => {
    if (name.trim().length < 3) { setNameDuplicates([]); return }
    try {
      const res = await fetch(
        `/api/lark/customers?check_duplicate=${encodeURIComponent(name.trim())}`,
      )
      const data = await res.json()
      // Client-side re-rank with vi normalization
      const raw: NameDuplicate[] = data.duplicates ?? []
      const needle = viNormalize(name.trim())
      const filtered = raw.filter(d => {
        const hay = viNormalize(d.ho_ten)
        // keep if normalized strings share prefix or have high overlap
        return hay.includes(needle.slice(0, 4)) || needle.includes(hay.slice(0, 4))
      })
      setNameDuplicates(filtered)
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
    setSaving(true)
    setError('')
    setDuplicateId(null)
    try {
      const res = await fetch('/api/lark/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sdt: sdtClean }),
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={onCancel} className="text-gray-500 p-1 -ml-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-base font-bold text-gray-800">Tạo khách hàng mới</h3>
        <div className="w-6" />
      </div>

      {/* Form */}
      <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">

        {/* HỌ TÊN */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">HỌ TÊN *</label>
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
                <button
                  key={d.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/customers/${d.id}`)}
                  className="w-full text-left text-xs text-amber-800 py-1 flex items-center gap-2"
                >
                  <span className="font-medium">{d.ho_ten}</span>
                  <span className="text-amber-500">· {d.sdt} · {d.pipeline}</span>
                  <span className="ml-auto text-blue-600 font-medium">Xem →</span>
                </button>
              ))}
              <p className="text-[10px] text-amber-500 mt-1">
                Nhấn tên KH để xem chi tiết. Nếu không trùng, tiếp tục tạo mới.
              </p>
            </div>
          )}
        </div>

        {/* SĐT */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">SỐ ĐIỆN THOẠI *</label>
          {duplicateId ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs text-red-700 font-semibold mb-1">⛔ SĐT đã tồn tại</p>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/customers/${duplicateId}`)}
                className="text-xs text-blue-600 font-medium underline"
              >
                Xem khách hàng hiện có →
              </button>
            </div>
          ) : (
            <input
              type="tel"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0901234567"
              value={form.sdt}
              onChange={e => { set('sdt', e.target.value); setDuplicateId(null) }}
            />
          )}
        </div>

        {/* EMAIL */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">EMAIL</label>
          <input
            type="email"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="example@gmail.com"
            value={form.email}
            onChange={e => set('email', e.target.value)}
          />
        </div>

        {/* NGUỒN KH */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">NGUỒN KHÁCH HÀNG</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.nguon_kh}
            onChange={e => set('nguon_kh', e.target.value)}
          >
            <option value="">— Chọn nguồn —</option>
            {NGUON_KH_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* LOẠI KH */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">LOẠI KHÁCH HÀNG</label>
          <div className="flex gap-2">
            {([
              { value: 'B2C',    label: '🏠 B2C',    sub: 'Cá nhân' },
              { value: 'Đại lý', label: '🏪 Đại lý', sub: 'Phân phối' },
              { value: 'Dự án',  label: '🏗️ Dự án',  sub: 'Công trình' },
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

        {/* KHU VỰC */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">KHU VỰC</label>
          <div className="flex gap-2">
            {(['Miền Nam', 'Miền Bắc', 'Miền Trung'] as const).map(k => (
              <button
                key={k}
                type="button"
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

        {/* LOẠI HÌNH NHÀ */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">LOẠI HÌNH NHÀ</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.loai_hinh_nha}
            onChange={e => set('loai_hinh_nha', e.target.value)}
          >
            <option value="">— Chọn loại —</option>
            {LOAI_HINH_NHA_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* NHÓM DỊCH VỤ */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">NHÓM DỊCH VỤ</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.nhom_dv}
            onChange={e => set('nhom_dv', e.target.value)}
          >
            <option value="">— Chọn nhóm dịch vụ —</option>
            {NHOM_DV_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* PIPELINE */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">TRẠNG THÁI PIPELINE</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.pipeline}
            onChange={e => set('pipeline', e.target.value)}
          >
            {PIPELINE_STAGES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {error && !duplicateId && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-2xl text-sm disabled:opacity-50"
        >
          {saving ? 'Đang tạo...' : 'Tạo & chọn khách hàng'}
        </button>
      </div>
    </div>
  )
}

// ─── CustomerPicker (main export) ─────────────────────────────────────────────

interface CustomerPickerProps {
  onSelect: (c: Customer) => void
  onClose: () => void
  allowCreate?: boolean
}

export default function CustomerPicker({
  onSelect,
  onClose,
  allowCreate = true,
}: CustomerPickerProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading]     = useState(true)
  const [q, setQ]                 = useState('')
  const [creating, setCreating]   = useState(false)

  useEffect(() => {
    fetch('/api/lark/customers')
      .then(r => r.json())
      .then(d => setCustomers(d.customers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const qNorm = viNormalize(q)
  const filtered = customers.filter(c => {
    if (!q) return true
    const hay = (c.ho_ten + c.sdt + (c.ma_kh ?? '')).toLowerCase()
    return hay.includes(q.toLowerCase()) || viNormalize(c.ho_ten).includes(qNorm)
  })

  const handleCreated = (c: Customer) => {
    // Add to local list so it shows immediately if user goes back
    setCustomers(prev => [c, ...prev])
    onSelect(c)
  }

  // ── Create flow ────────────────────────────────────────────────────────────
  if (creating) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-white">
        <InlineCreateForm
          initialName={q}
          onCreated={handleCreated}
          onCancel={() => setCreating(false)}
        />
      </div>
    )
  }

  // ── Search / list flow ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-bold text-gray-800 flex-1">Chọn khách hàng</h2>
      </div>

      {/* Search bar */}
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
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
            <span className="crm-spinner" /><span>Đang tải...</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-4">
            <p className="text-gray-400 text-sm">
              {q ? `Không tìm thấy "${q}"` : 'Chưa có khách hàng'}
            </p>
            {allowCreate && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl"
              >
                <span>＋</span>
                <span>Tạo KH mới{q ? `: "${q}"` : ''}</span>
              </button>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && filtered.map(c => (
          <button
            key={c.record_id}
            onClick={() => onSelect(c)}
            className="w-full px-4 py-3.5 border-b border-gray-50 text-left flex items-center gap-3 active:bg-blue-50"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-blue-600">{c.ho_ten?.[0] ?? '?'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{c.ho_ten}</p>
              <p className="text-xs text-gray-400">{c.sdt}{c.ma_kh ? ` · ${c.ma_kh}` : ''}</p>
            </div>
            <span className="text-xs text-blue-600 flex-shrink-0">Chọn</span>
          </button>
        ))}

        {/* "Tạo mới" sticky button when list is non-empty */}
        {!loading && filtered.length > 0 && allowCreate && (
          <button
            onClick={() => setCreating(true)}
            className="w-full px-4 py-4 flex items-center gap-3 text-blue-600 border-t border-gray-100"
          >
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-light">＋</span>
            </div>
            <span className="text-sm font-semibold">Tạo khách hàng mới</span>
          </button>
        )}
      </div>
    </div>
  )
}
