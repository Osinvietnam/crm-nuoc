'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLE_LABEL: Record<string, string> = {
  admin:      'Quản trị viên',
  ceo:        'Giám đốc',
  tech_lead:  'Trưởng phòng KT',
  accountant: 'Kế toán',
  sales:      'Kinh doanh',
  tech:       'Kỹ thuật viên',
  logistics:  'Hậu cần',
  partner:    'Đối tác',
}

const STATUS_COLOR: Record<string, string> = {
  'Đang làm': 'bg-green-100 text-green-700',
  'Thử việc': 'bg-blue-100 text-blue-700',
  'Tạm nghỉ': 'bg-yellow-100 text-yellow-700',
  'Nghỉ việc': 'bg-red-100 text-red-600',
}

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  phone: string | null
  chuc_vu: string | null
  khu_vuc: string | null
  trang_thai_nv: string
  ngay_vao_lam: string | null
  ngay_sinh: string | null
  dia_chi: string | null
  cccd: string | null
  so_tk_nh: string | null
  ngan_hang: string | null
  tinh_trang_hn: string | null
  target_thang: number | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')
  const [form, setForm] = useState({ phone: '', ngay_sinh: '', dia_chi: '' })

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d.profile)
        setForm({
          phone:     d.profile?.phone     ?? '',
          ngay_sinh: d.profile?.ngay_sinh ?? '',
          dia_chi:   d.profile?.dia_chi   ?? '',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setProfile(p => p ? { ...p, ...form } : p)
      setEditing(false)
      setMsg('Đã lưu thành công.')
    } else {
      setMsg('Lỗi khi lưu. Vui lòng thử lại.')
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!profile) return null

  const initials = profile.full_name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-500 text-lg px-1">←</button>
        <h1 className="text-base font-semibold text-gray-800">Hồ sơ cá nhân</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

        {/* Avatar & name */}
        <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-white">{initials}</span>
          </div>
          <h2 className="text-lg font-bold text-gray-800">{profile.full_name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
              {ROLE_LABEL[profile.role] ?? profile.role}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLOR[profile.trang_thai_nv] ?? 'bg-gray-100 text-gray-600'}`}>
              {profile.trang_thai_nv}
            </span>
          </div>
        </div>

        {/* Thông tin công việc (readonly) */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin công việc</p>
          </div>
          <div className="divide-y">
            <Row label="Chức vụ"      value={profile.chuc_vu} />
            <Row label="Khu vực"      value={profile.khu_vuc} />
            <Row label="Ngày vào làm" value={profile.ngay_vao_lam} />
            {profile.target_thang ? (
              <Row label="Target tháng" value={profile.target_thang.toLocaleString('vi-VN') + ' ₫'} />
            ) : null}
          </div>
        </div>

        {/* Thông tin cá nhân (NV tự sửa được) */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin cá nhân</p>
            {!editing && (
              <button onClick={() => setEditing(true)}
                className="text-xs text-blue-600 font-medium">Sửa</button>
            )}
          </div>

          {editing ? (
            <div className="p-4 space-y-3">
              <Field label="Số điện thoại" value={form.phone}
                onChange={v => setForm(f => ({ ...f, phone: v }))}
                placeholder="0901 234 567" />
              <Field label="Ngày sinh" value={form.ngay_sinh} type="date"
                onChange={v => setForm(f => ({ ...f, ngay_sinh: v }))} />
              <Field label="Địa chỉ" value={form.dia_chi}
                onChange={v => setForm(f => ({ ...f, dia_chi: v }))}
                placeholder="Số nhà, đường, quận/huyện, tỉnh/thành" />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600">
                  Hủy
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              <Row label="Số điện thoại" value={profile.phone} />
              <Row label="Ngày sinh"     value={profile.ngay_sinh} />
              <Row label="Địa chỉ"       value={profile.dia_chi} />
              <Row label="Tình trạng HN" value={profile.tinh_trang_hn} />
            </div>
          )}
        </div>

        {/* Thông tin tài chính (readonly — chỉ admin/ceo mới sửa) */}
        {(profile.cccd || profile.so_tk_nh) && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tài chính & Giấy tờ</p>
            </div>
            <div className="divide-y">
              <Row label="CMND / CCCD"    value={profile.cccd} />
              <Row label="Ngân hàng"      value={profile.ngan_hang} />
              <Row label="Số tài khoản"   value={profile.so_tk_nh} />
            </div>
          </div>
        )}

        {msg && (
          <p className={`text-sm text-center px-4 py-2 rounded-xl ${
            msg.includes('Lỗi') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
          }`}>{msg}</p>
        )}

      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start justify-between px-4 py-3 gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right">{value || '—'}</span>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
