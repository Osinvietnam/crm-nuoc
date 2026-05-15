'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  admin:      'Quản trị viên',
  ceo:        'Giám đốc',
  director:   'Giám đốc / Quản lý',
  accountant: 'Kế toán',
  sales:      'Kinh doanh',
  tech:       'Kỹ thuật viên',
  logistics:  'Hậu cần',
  partner:    'Đối tác',
}

const KHU_VUC_LABEL: Record<string, string> = {
  CN: 'Cả nước',
  MN: 'Miền Nam',
  MB: 'Miền Bắc',
  MT: 'Miền Trung',
}

const STATUS_COLOR: Record<string, string> = {
  'Đang làm': 'bg-green-100 text-green-700',
  'Thử việc': 'bg-blue-100 text-blue-700',
  'Tạm nghỉ': 'bg-yellow-100 text-yellow-700',
  'Nghỉ việc': 'bg-red-100 text-red-600',
}

// Roles hiển thị target tháng (CEO / director / partner không cần)
const ROLES_WITH_TARGET = ['sales', 'tech', 'logistics', 'accountant']

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('vi-VN')
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
  ma_nv: string | null
  ma_doi_tac: string | null
  loai_doi_tac: string | null
}

// ─── Change Password Section ──────────────────────────────────────────────────

function ChangePasswordSection() {
  const [open,    setOpen]    = useState(false)
  const [form,    setForm]    = useState({ pwd: '', confirm: '' })
  const [saving,  setSaving]  = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [msg,     setMsg]     = useState('')
  const [err,     setErr]     = useState('')

  const handleSubmit = async () => {
    if (form.pwd.length < 8) { setErr('Mật khẩu phải có ít nhất 8 ký tự'); return }
    if (form.pwd !== form.confirm) { setErr('Mật khẩu xác nhận không khớp'); return }
    setSaving(true); setErr('')
    const res = await fetch('/api/profile/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: form.pwd }),
    })
    if (res.ok) {
      setMsg('Đã đổi mật khẩu thành công')
      setOpen(false)
      setForm({ pwd: '', confirm: '' })
    } else {
      const d = await res.json()
      setErr(d.error || 'Lỗi đổi mật khẩu')
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bảo mật</p>
        <button onClick={() => { setOpen(o => !o); setErr(''); setMsg('') }}
          className="text-xs text-blue-600 font-medium">
          {open ? 'Đóng' : 'Đổi mật khẩu'}
        </button>
      </div>

      {msg && !open && (
        <p className="px-4 py-3 text-sm text-green-600 bg-green-50">✅ {msg}</p>
      )}

      {open && (
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mật khẩu mới</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.pwd}
                onChange={e => setForm(f => ({ ...f, pwd: e.target.value }))}
                placeholder="Ít nhất 8 ký tự"
                className="w-full px-3 py-3 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Xác nhận mật khẩu mới</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Nhập lại mật khẩu mới"
              className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setOpen(false); setErr('') }}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-sm text-gray-600">
              Huỷ
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-3 rounded-xl bg-blue-600 disabled:bg-blue-400 text-white text-sm font-medium">
              {saving ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [editing,        setEditing]        = useState(false)
  const [editingFinance, setEditingFinance] = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [msg,            setMsg]            = useState('')
  const [form,     setForm]      = useState({ phone: '', ngay_sinh: '', dia_chi: '' })
  const [finForm,  setFinForm]   = useState({ cccd: '', ngan_hang: '', so_tk_nh: '' })

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
        setFinForm({
          cccd:      d.profile?.cccd      ?? '',
          ngan_hang: d.profile?.ngan_hang ?? '',
          so_tk_nh:  d.profile?.so_tk_nh  ?? '',
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

  const handleSaveFinance = async () => {
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finForm),
    })
    if (res.ok) {
      setProfile(p => p ? { ...p, ...finForm } : p)
      setEditingFinance(false)
      setMsg('Đã lưu thông tin tài chính.')
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
  const showTarget  = ROLES_WITH_TARGET.includes(profile.role) && !!profile.target_thang
  const showFinance = profile.role === 'accountant' || !!(profile.cccd || profile.so_tk_nh)
  const showPartner = profile.role === 'partner'
  const isSales     = profile.role === 'sales'

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
          {profile.ma_nv && (
            <p className="text-xs font-mono text-gray-400 mt-1">{profile.ma_nv}</p>
          )}
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
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
            {profile.chuc_vu && <Row label="Chức vụ"      value={profile.chuc_vu} />}
            {profile.khu_vuc && (
              <Row label="Khu vực" value={KHU_VUC_LABEL[profile.khu_vuc] ?? profile.khu_vuc} />
            )}
            {profile.ngay_vao_lam && (
              <Row label="Ngày vào làm" value={fmtDate(profile.ngay_vao_lam)} />
            )}
            {showTarget && (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-500">Target tháng</span>
                  <span className="text-sm font-semibold text-blue-700">
                    {profile.target_thang!.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-blue-400 rounded-full" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Dữ liệu thực tế cập nhật cuối tháng</p>
              </div>
            )}
          </div>
        </div>

        {/* Partner info (partner only) */}
        {showPartner && (profile.ma_doi_tac || profile.loai_doi_tac) && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin đối tác</p>
            </div>
            <div className="divide-y">
              <Row label="Loại đối tác"  value={profile.loai_doi_tac} />
              <Row label="Mã đối tác"    value={profile.ma_doi_tac} />
            </div>
          </div>
        )}

        {/* Thông tin cá nhân (NV tự sửa được) */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin cá nhân</p>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-blue-600 font-medium">Sửa</button>
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
                  className="flex-1 py-3 rounded-xl border border-gray-300 text-sm text-gray-600">
                  Hủy
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              <Row label="Số điện thoại" value={profile.phone} />
              <Row label="Ngày sinh"     value={fmtDate(profile.ngay_sinh)} />
              <Row label="Địa chỉ"       value={profile.dia_chi} />
              <Row label="Tình trạng HN" value={profile.tinh_trang_hn} />
            </div>
          )}
        </div>

        {/* Tài chính & Giấy tờ — luôn hiện với kế toán, hoặc khi có dữ liệu */}
        {showFinance && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tài chính & Giấy tờ</p>
                </div>
              {!editingFinance && (
                <button onClick={() => setEditingFinance(true)} className="text-xs text-blue-600 font-medium">Sửa</button>
              )}
            </div>
            {editingFinance ? (
              <div className="p-4 space-y-3">
                <Field label="CMND / CCCD" value={finForm.cccd}
                  onChange={v => setFinForm(f => ({ ...f, cccd: v }))} placeholder="012345678901" />
                <Field label="Ngân hàng" value={finForm.ngan_hang}
                  onChange={v => setFinForm(f => ({ ...f, ngan_hang: v }))} placeholder="Vietcombank" />
                <Field label="Số tài khoản" value={finForm.so_tk_nh}
                  onChange={v => setFinForm(f => ({ ...f, so_tk_nh: v }))} placeholder="0123456789" />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingFinance(false)}
                    className="flex-1 py-3 rounded-xl border border-gray-300 text-sm text-gray-600">Hủy</button>
                  <button onClick={handleSaveFinance} disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                    {saving ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                <Row label="CMND / CCCD"  value={profile.cccd} />
                <Row label="Ngân hàng"    value={profile.ngan_hang} />
                <Row label="Số tài khoản" value={profile.so_tk_nh} />
              </div>
            )}
          </div>
        )}

        {/* Quick links — sales */}
        {isSales && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Truy cập nhanh</p>
            </div>
            <div className="divide-y">
              <button onClick={() => router.push('/dashboard/customers')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <span className="text-sm text-gray-700">👥 Khách hàng của tôi</span>
                <span className="text-gray-400 text-sm">→</span>
              </button>
              <button onClick={() => router.push('/dashboard/contracts')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <span className="text-sm text-gray-700">📦 Đơn hàng của tôi</span>
                <span className="text-gray-400 text-sm">→</span>
              </button>
            </div>
          </div>
        )}

        {/* Bảo mật — đổi mật khẩu */}
        <ChangePasswordSection />

        {msg && (
          <p className={`text-sm text-center px-4 py-2 rounded-xl ${
            msg.includes('Lỗi') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
          }`}>{msg}</p>
        )}

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start justify-between px-4 py-3 gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right break-words max-w-[60%]">{value || '—'}</span>
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
        className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
