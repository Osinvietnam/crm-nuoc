'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CompanySettings } from '@/app/api/admin/settings/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string
  full_name: string
  email: string
  role: string
  phone: string
  chuc_vu: string
  khu_vuc: string
  bo_phan: string | null
  ma_nv: string | null
  chuc_danh: string | null
  target_thang: number | null
  ngay_vao_lam: string | null
  trang_thai_nv: string
  is_active: boolean
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'sales',      label: 'Kinh doanh'         },
  { value: 'tech',       label: 'Kỹ thuật'            },
  { value: 'logistics',  label: 'Hậu cần'             },
  { value: 'director',   label: 'Giám đốc / Quản lý'   },
  { value: 'accountant', label: 'Kế toán'              },
  { value: 'ceo',        label: 'Giám đốc'             },
  { value: 'admin',      label: 'Quản trị viên'        },
  { value: 'partner',    label: 'Đối tác'              },
]

const ROLE_COLOR: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-700',
  ceo:        'bg-indigo-100 text-indigo-700',
  director:   'bg-orange-100 text-orange-700',
  accountant: 'bg-teal-100 text-teal-700',
  sales:      'bg-green-100 text-green-700',
  tech:       'bg-amber-100 text-amber-700',
  logistics:  'bg-cyan-100 text-cyan-700',
  partner:    'bg-gray-100 text-gray-600',
}

const ROLE_LABEL: Record<string, string> = {
  admin:      'Quản trị viên',
  ceo:        'Giám đốc',
  director:   'Giám đốc / Quản lý',
  accountant: 'Kế toán',
  sales:      'Kinh doanh',
  tech:       'Kỹ thuật',
  logistics:  'Hậu cần',
  partner:    'Đối tác',
}

function initials(name: string) {
  return name?.charAt(0)?.toUpperCase() ?? '?'
}

// ─── Deactivate Modal ─────────────────────────────────────────────────────────

function DeactivateModal({
  target,
  managers,
  onClose,
  onDone,
}: {
  target: StaffUser
  managers: StaffUser[]
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [newOwnerId,   setNewOwnerId]   = useState('')
  const [confirming,   setConfirming]   = useState(false)
  const [step,         setStep]         = useState<'pick' | 'confirm'>('pick')
  const [error,        setError]        = useState('')

  const candidates = managers.filter(m => m.id !== target.id && m.is_active)
  const picked = candidates.find(c => c.id === newOwnerId)

  const handleDeactivate = async () => {
    if (!picked) return
    setConfirming(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${target.id}/deactivate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          new_owner_name: picked.full_name,
          new_owner_id:   picked.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi khoá tài khoản'); return }
      onDone(data.message ?? 'Đã khoá tài khoản và bàn giao thành công')
    } catch {
      setError('Lỗi kết nối')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl p-5 space-y-4">
        <div className="flex justify-center -mt-2 mb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {step === 'pick' ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-lg">🔒</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">Khoá tài khoản</h2>
                <p className="text-xs text-gray-500">{target.full_name} — {ROLE_LABEL[target.role]}</p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-700">
              Trước khi khoá, chọn người nhận bàn giao toàn bộ khách hàng và đơn hàng đang phụ trách.
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600 mb-2 block">BÀN GIAO CHO</label>
              {candidates.length === 0 ? (
                <p className="text-sm text-red-500">Không có quản lý/admin nào đang hoạt động để bàn giao.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {candidates.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setNewOwnerId(c.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        newOwnerId === c.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold ${
                        newOwnerId === c.id ? 'bg-blue-600' : 'bg-gray-400'
                      }`}>
                        {initials(c.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{c.full_name}</p>
                        <p className="text-xs text-gray-500">{ROLE_LABEL[c.role]}</p>
                      </div>
                      {newOwnerId === c.id && (
                        <span className="text-blue-600 text-base">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">
                Huỷ
              </button>
              <button
                onClick={() => { if (newOwnerId) setStep('confirm') }}
                disabled={!newOwnerId}
                className="flex-1 bg-red-500 disabled:bg-red-300 text-white font-medium py-3 rounded-xl text-sm"
              >
                Tiếp tục
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-red-50 rounded-xl px-4 py-4 space-y-1">
              <p className="text-sm font-bold text-red-700">Xác nhận khoá tài khoản</p>
              <p className="text-xs text-red-600">
                Khoá <strong>{target.full_name}</strong> và bàn giao tất cả dữ liệu cho{' '}
                <strong>{picked?.full_name}</strong>.
              </p>
              <p className="text-xs text-red-400 mt-1">
                Thao tác này không thể hoàn tác. User bị khoá sẽ không thể đăng nhập.
              </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep('pick')}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">
                Quay lại
              </button>
              <button
                onClick={handleDeactivate}
                disabled={confirming}
                className="flex-1 bg-red-600 disabled:bg-red-400 text-white font-medium py-3 rounded-xl text-sm"
              >
                {confirming ? 'Đang xử lý...' : '🔒 Xác nhận khoá'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Create User Sheet ────────────────────────────────────────────────────────

function CreateUserSheet({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: (msg: string, tempPwd: string, email: string) => void
}) {
  const [form, setForm] = useState({
    full_name: '', email: '', role: 'sales', khu_vuc: 'MN', chuc_vu: '',
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const f = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleCreate = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Họ tên và email là bắt buộc'); return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tạo tài khoản'); return }
      onDone(`Đã tạo tài khoản ${form.full_name}`, data.temp_password, form.email)
    } catch {
      setError('Lỗi kết nối')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center -mt-2 mb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 text-lg">👤</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">Thêm nhân viên mới</h2>
            <p className="text-xs text-gray-500">Mật khẩu tạm <strong>GWS@2026</strong> — nhân viên đổi lần đầu đăng nhập</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">HỌ TÊN <span className="text-red-400">*</span></label>
            <input
              value={form.full_name} onChange={e => f('full_name')(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">EMAIL <span className="text-red-400">*</span></label>
            <input
              type="email" value={form.email} onChange={e => f('email')(e.target.value)}
              placeholder="email@gmail.com"
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">CHỨC VỤ</label>
            <input
              value={form.chuc_vu} onChange={e => f('chuc_vu')(e.target.value)}
              placeholder="Nhân viên Kinh doanh"
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">VAI TRÒ</label>
              <select
                value={form.role} onChange={e => f('role')(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">KHU VỰC</label>
              <select
                value={form.khu_vuc} onChange={e => f('khu_vuc')(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="CN">Cả nước</option>
                <option value="MN">Miền Nam</option>
                <option value="MB">Miền Bắc</option>
                <option value="MT">Miền Trung</option>
              </select>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">
            Huỷ
          </button>
          <button
            onClick={handleCreate} disabled={saving}
            className="flex-1 bg-blue-600 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl text-sm"
          >
            {saving ? 'Đang tạo...' : '✅ Tạo tài khoản'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Temp Password Toast ──────────────────────────────────────────────────────

function TempPasswordToast({
  email,
  tempPwd,
  onClose,
  title = 'Tạo tài khoản thành công',
}: {
  email: string
  tempPwd: string
  onClose: () => void
  title?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl">
        <div className="text-center">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="text-base font-bold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500 mt-1">Thông báo cho nhân viên qua Zalo/điện thoại</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Email</span>
            <span className="font-medium text-gray-800">{email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Mật khẩu tạm</span>
            <span className="font-mono font-bold text-blue-700 text-base">{tempPwd}</span>
          </div>
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">
          ⚠️ Nhân viên cần đổi mật khẩu ngay lần đầu đăng nhập
        </p>
        <button
          onClick={onClose}
          className="w-full bg-blue-600 text-white font-medium py-3 rounded-xl text-sm"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  )
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({
  target,
  onClose,
  onDone,
}: {
  target: StaffUser
  onClose: () => void
  onDone: (email: string, pwd: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const handleReset = async () => {
    setSaving(true)
    setErr('')
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'
    const tempPwd = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    try {
      const res = await fetch(`/api/admin/users/${target.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: tempPwd }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? `Lỗi ${res.status}`); return }
      onDone(target.email, tempPwd)
    } catch {
      setErr('Lỗi kết nối')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl">
        <h2 className="text-base font-bold text-gray-800">Đặt lại mật khẩu</h2>
        <p className="text-sm text-gray-600">
          Đặt lại mật khẩu cho <strong>{target.full_name}</strong>?
          Hệ thống sẽ tạo mật khẩu tạm ngẫu nhiên.
        </p>
        {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-300 text-sm text-gray-600">
            Hủy
          </button>
          <button onClick={handleReset} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-medium disabled:opacity-50">
            {saving ? 'Đang xử lý...' : 'Đặt lại MK'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Unlock Confirm Modal ─────────────────────────────────────────────────────

function UnlockConfirmModal({
  target,
  onClose,
  onConfirm,
  confirming,
}: {
  target: StaffUser
  onClose: () => void
  onConfirm: () => void
  confirming: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl p-5 space-y-4">
        <div className="flex justify-center -mt-2 mb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-green-600 text-lg">🔓</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">Mở khoá tài khoản</h2>
            <p className="text-xs text-gray-500">{target.full_name} — {ROLE_LABEL[target.role]}</p>
          </div>
        </div>
        <div className="bg-green-50 rounded-xl px-4 py-3 text-xs text-green-700">
          Tài khoản sẽ được kích hoạt lại. Nhân viên có thể đăng nhập ngay sau khi mở khoá.
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">
            Huỷ
          </button>
          <button
            onClick={onConfirm} disabled={confirming}
            className="flex-1 bg-green-600 disabled:bg-green-400 text-white font-medium py-3 rounded-xl text-sm"
          >
            {confirming ? 'Đang xử lý...' : '🔓 Xác nhận mở khoá'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Change Role Sheet ────────────────────────────────────────────────────────

function ChangeRoleSheet({
  target,
  onClose,
  onDone,
}: {
  target: StaffUser
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [selectedRole, setSelectedRole] = useState(target.role)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const handleSave = async () => {
    if (selectedRole === target.role) { onClose(); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: target.id, role: selectedRole }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi cập nhật'); return }
      onDone(`Đã đổi vai trò ${target.full_name} → ${ROLE_LABEL[selectedRole]}`)
    } catch {
      setError('Lỗi kết nối')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl p-5 space-y-4">
        <div className="flex justify-center -mt-2 mb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <h2 className="text-base font-bold text-gray-800">Đổi vai trò</h2>
        <p className="text-xs text-gray-500">{target.full_name}</p>

        <div className="space-y-2">
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelectedRole(opt.value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                selectedRole === opt.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{opt.label}</span>
              {selectedRole === opt.value && <span className="text-blue-600">✓</span>}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm">
            Huỷ
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedRole === target.role}
            className="flex-1 bg-blue-600 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl text-sm"
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Company Settings Tab ─────────────────────────────────────────────────────

function CompanySettingsTab() {
  const [form,         setForm]         = useState<CompanySettings>({ name: '', address: '', phone: '', email: '', tax: '', website: '', logo_url: '', bank_name: '', account_number: '', account_holder: '', quote_expiry_days: 14, quote_terms: '', contract_payment_terms: '', contract_terms: '' })
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [success,      setSuccess]      = useState('')
  const [error,        setError]        = useState('')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => { if (d.data) setForm(d.data) })
      .catch(() => setError('Lỗi tải thông tin'))
      .finally(() => setLoading(false))
  }, [])

  const set = (k: keyof CompanySettings, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi lưu'); return }
      setSuccess('Đã lưu thông tin công ty')
      setTimeout(() => setSuccess(''), 3000)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true); setError(''); setSuccess('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/settings/logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi upload logo'); return }
      setForm(f => ({ ...f, logo_url: data.url }))
      setSuccess('Đã cập nhật logo')
      setTimeout(() => setSuccess(''), 3000)
    } catch { setError('Lỗi kết nối') }
    finally { setUploadingLogo(false); e.target.value = '' }
  }

  const handleLogoDelete = async () => {
    setUploadingLogo(true); setError('')
    try {
      const res = await fetch('/api/admin/settings/logo', { method: 'DELETE' })
      if (!res.ok) { setError('Lỗi xoá logo'); return }
      setForm(f => ({ ...f, logo_url: '' }))
    } catch { setError('Lỗi kết nối') }
    finally { setUploadingLogo(false) }
  }

  const textFields: { key: keyof CompanySettings; label: string; placeholder: string; type?: string; section?: string }[] = [
    { key: 'name',           label: 'TÊN CÔNG TY *',     placeholder: 'Công ty TNHH GWS Việt Nam' },
    { key: 'address',        label: 'ĐỊA CHỈ',            placeholder: '123 Nguyễn Văn Linh, Q7, TP.HCM' },
    { key: 'phone',          label: 'SỐ ĐIỆN THOẠI',      placeholder: '028 1234 5678' },
    { key: 'email',          label: 'EMAIL',               placeholder: 'info@gws.com.vn', type: 'email' },
    { key: 'tax',            label: 'MÃ SỐ THUẾ',         placeholder: '0312345678' },
    { key: 'website',        label: 'WEBSITE',             placeholder: 'https://gws.com.vn' },
    { key: 'bank_name',      label: 'NGÂN HÀNG',          placeholder: 'Vietcombank - CN TP.HCM', section: 'bank' },
    { key: 'account_number', label: 'SỐ TÀI KHOẢN',      placeholder: '0123456789', section: 'bank' },
    { key: 'account_holder', label: 'CHỦ TÀI KHOẢN',     placeholder: 'CÔNG TY TNHH GWS VIỆT NAM', section: 'bank' },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700">
        Thông tin này sẽ hiển thị trên PDF báo giá và file XLSX xuất ra.
      </div>

      {/* Logo */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="text-sm font-semibold text-gray-600 mb-3 block">LOGO CÔNG TY</label>
        <div className="flex items-center gap-4">
          {/* Preview */}
          <div className="w-24 h-16 border border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 flex-shrink-0 overflow-hidden">
            {form.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
            ) : (
              <span className="text-2xl">🏢</span>
            )}
          </div>
          {/* Actions */}
          <div className="flex-1 space-y-2">
            <label className={`block w-full text-center border-2 border-dashed border-blue-200 text-blue-600 text-xs font-semibold py-2 rounded-xl cursor-pointer hover:bg-blue-50 ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploadingLogo ? 'Đang upload...' : '📤 Tải logo lên'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
            </label>
            {form.logo_url && (
              <button onClick={handleLogoDelete} disabled={uploadingLogo}
                className="w-full border border-red-200 text-red-500 text-xs font-semibold py-2 rounded-xl hover:bg-red-50">
                Xoá logo
              </button>
            )}
            <p className="text-xs text-gray-500">JPG, PNG, WebP, SVG · Tối đa 2MB</p>
          </div>
        </div>
      </div>

      {/* Thông tin công ty */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        {textFields.filter(f => !f.section).map(f => (
          <div key={f.key}>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">{f.label}</label>
            <input
              type={f.type ?? 'text'}
              value={form[f.key] as string}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      {/* Thông tin ngân hàng */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Thông tin ngân hàng sẽ hiển thị trên PDF hợp đồng để khách hàng chuyển khoản.
        </div>
        {textFields.filter(f => f.section === 'bank').map(f => (
          <div key={f.key}>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">{f.label}</label>
            <input
              type={f.type ?? 'text'}
              value={form[f.key] as string}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      {/* Cấu hình báo giá */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="text-sm font-semibold text-gray-600 mb-1 block">HIỆU LỰC BÁO GIÁ (ngày)</label>
        <input
          type="number" min={1} max={365}
          value={form.quote_expiry_days}
          onChange={e => setForm(f => ({ ...f, quote_expiry_days: Number(e.target.value) }))}
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1.5">Số ngày báo giá có hiệu lực kể từ ngày tạo. Hiển thị trên PDF báo giá.</p>
      </div>

      {/* Điều khoản PDF */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
          Điều khoản sẽ xuất hiện trên PDF. Mỗi dòng = 1 mục. Để trống = dùng mặc định.
        </p>
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">ĐIỀU KHOẢN BÁO GIÁ</label>
          <textarea
            rows={4}
            value={form.quote_terms}
            onChange={e => setForm(f => ({ ...f, quote_terms: e.target.value }))}
            placeholder={'• Báo giá có hiệu lực trong vòng 14 ngày kể từ ngày lập.\n• Giá chưa bao gồm VAT (nếu có).\n• Thời gian giao hàng và điều kiện thanh toán theo thỏa thuận.'}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">ĐIỀU KHOẢN THANH TOÁN HỢP ĐỒNG</label>
          <textarea
            rows={4}
            value={form.contract_payment_terms}
            onChange={e => setForm(f => ({ ...f, contract_payment_terms: e.target.value }))}
            placeholder={'• Đợt 1 (60%): Thanh toán khi ký hợp đồng\n• Đợt 2 (35%): Thanh toán khi nghiệm thu bàn giao\n• Đợt 3 (5%): Thanh toán sau bảo hành 12 tháng'}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">ĐIỀU KHOẢN HỢP ĐỒNG ĐẦY ĐỦ</label>
          <textarea
            rows={6}
            value={form.contract_terms}
            onChange={e => setForm(f => ({ ...f, contract_terms: e.target.value }))}
            placeholder={'Điền điều khoản hợp đồng đầy đủ ở đây...\nMỗi dòng sẽ hiển thị thành 1 dòng trong PDF hợp đồng.'}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1.5">Phần này chỉ hiển thị nếu bạn đã điền nội dung.</p>
        </div>
      </div>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✅ {success}</div>}
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠️ {error}</div>}

      <button
        onClick={handleSave}
        disabled={saving || !form.name.trim()}
        className="w-full bg-blue-600 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl text-sm"
      >
        {saving ? 'Đang lưu...' : 'Lưu thông tin công ty'}
      </button>
    </div>
  )
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

interface AuditLog {
  id: number
  user_name: string
  action: string
  entity: string
  detail: string
  created_at: string
}

const ACTION_LABEL: Record<string, string> = {
  role_changed:          'Đổi vai trò',
  user_created:          'Tạo tài khoản',
  user_deactivated:      'Khoá tài khoản',
  user_reactivated:      'Mở khoá tài khoản',
  profile_updated:       'Cập nhật hồ sơ',
  password_reset:        'Đổi mật khẩu',
  settings_updated:      'Cập nhật cài đặt',
  logo_updated:          'Cập nhật logo',
  logo_deleted:          'Xoá logo',
  quote_created:         'Tạo báo giá',
  quote_status_changed:  'Đổi trạng thái BG',
  quote_duplicated:      'Nhân bản báo giá',
  order_created:         'Tạo đơn hàng',
  order_updated:         'Cập nhật đơn hàng',
  task_started:          'Bắt đầu task',
  task_updated:          'Cập nhật task',
  task_reset:            'Đặt lại task',
  customer_created:      'Tạo khách hàng',
  customer_updated:      'Cập nhật KH',
  customer_reassigned:   'Chuyển phụ trách KH',
  payment_created:       'Ghi thu',
  payment_updated:       'Cập nhật thanh toán',
  payment_deleted:       'Xoá thanh toán',
  expense_created:       'Tạo chi phí',
  expense_updated:       'Cập nhật chi phí',
  expense_deleted:       'Xoá chi phí',
  commission_paid:       'Đánh dấu trả HH',
  commission_unpaid:     'Huỷ trả HH',
  product_created:       'Tạo sản phẩm',
  product_updated:       'Cập nhật SP',
  product_deleted:       'Xoá sản phẩm',
  asset_created:         'Thêm tài sản',
  asset_updated:         'Cập nhật tài sản',
  kpi_target_set:        'Đặt KPI',
  permissions_updated:   'Cập nhật quyền',
  permissions_reset:     'Reset quyền về mặc định',
}

const ACTION_COLOR: Record<string, string> = {
  role_changed:         'bg-blue-100 text-blue-700',
  user_created:         'bg-emerald-100 text-emerald-700',
  user_deactivated:     'bg-red-100 text-red-700',
  user_reactivated:     'bg-green-100 text-green-700',
  profile_updated:      'bg-sky-100 text-sky-700',
  password_reset:       'bg-sky-100 text-sky-700',
  settings_updated:     'bg-purple-100 text-purple-700',
  logo_updated:         'bg-orange-100 text-orange-700',
  logo_deleted:         'bg-gray-100 text-gray-600',
  quote_created:        'bg-amber-100 text-amber-700',
  quote_status_changed: 'bg-amber-100 text-amber-700',
  quote_duplicated:     'bg-amber-100 text-amber-700',
  order_created:        'bg-indigo-100 text-indigo-700',
  order_updated:        'bg-indigo-100 text-indigo-700',
  task_started:         'bg-teal-100 text-teal-700',
  task_updated:         'bg-teal-100 text-teal-700',
  task_reset:           'bg-red-100 text-red-700',
  customer_created:     'bg-green-100 text-green-700',
  customer_updated:     'bg-green-100 text-green-700',
  customer_reassigned:  'bg-blue-100 text-blue-700',
  payment_created:      'bg-lime-100 text-lime-700',
  payment_updated:      'bg-lime-100 text-lime-700',
  payment_deleted:      'bg-red-100 text-red-700',
  expense_created:      'bg-orange-100 text-orange-700',
  expense_updated:      'bg-orange-100 text-orange-700',
  expense_deleted:      'bg-red-100 text-red-700',
  commission_paid:      'bg-green-100 text-green-700',
  commission_unpaid:    'bg-gray-100 text-gray-600',
  product_created:      'bg-cyan-100 text-cyan-700',
  product_updated:      'bg-cyan-100 text-cyan-700',
  product_deleted:      'bg-red-100 text-red-700',
  asset_created:        'bg-violet-100 text-violet-700',
  asset_updated:        'bg-violet-100 text-violet-700',
  kpi_target_set:       'bg-purple-100 text-purple-700',
  permissions_updated:  'bg-violet-100 text-violet-700',
  permissions_reset:    'bg-orange-100 text-orange-700',
}

function AuditLogTab() {
  const [logs,      setLogs]      = useState<AuditLog[]>([])
  const [loading,   setLoading]   = useState(true)
  const [total,     setTotal]     = useState(0)
  const [offset,    setOffset]    = useState(0)
  const [fAction,   setFAction]   = useState('')
  const [fUser,     setFUser]     = useState('')
  const [fEntity,   setFEntity]   = useState('')
  const [fFrom,     setFFrom]     = useState('')
  const [fTo,       setFTo]       = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const LIMIT = 20

  const buildQuery = (off = 0) => {
    const p = new URLSearchParams({ limit: String(LIMIT), offset: String(off) })
    if (fAction) p.set('action', fAction)
    if (fUser)   p.set('user_name', fUser)
    if (fEntity) p.set('entity', fEntity)
    if (fFrom)   p.set('from', fFrom)
    if (fTo)     p.set('to', fTo + 'T23:59:59')
    return `/api/admin/audit?${p}`
  }

  const load = async (off = 0) => {
    setLoading(true)
    try {
      const res  = await fetch(buildQuery(off))
      const data = await res.json()
      setLogs(data.data ?? [])
      setTotal(data.total ?? 0)
      setOffset(off)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const exportCSV = async () => {
    const res  = await fetch(buildQuery(0).replace(`limit=${LIMIT}`, 'limit=2000'))
    const json = await res.json()
    const rows: AuditLog[] = json.data ?? []
    const header = 'Thời gian,Người dùng,Hành động,Đối tượng,Chi tiết'
    const lines  = rows.map(r =>
      [fmtTime(r.created_at), r.user_name, ACTION_LABEL[r.action] ?? r.action, r.entity, `"${r.detail.replace(/"/g, '""')}"`].join(',')
    )
    const blob = new Blob(['﻿' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `audit_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fmtTime = (iso: string) => new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const hasFilter = fAction || fUser || fEntity || fFrom || fTo

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <p className="text-xs text-gray-500 flex-1">{total} hoạt động</p>
        <button onClick={exportCSV} className="text-xs text-green-600 font-medium bg-green-50 px-3 py-1.5 rounded-lg">
          ↓ CSV
        </button>
        <button
          onClick={() => setShowFilter(v => !v)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg ${hasFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          🔍 Lọc{hasFilter ? ' ●' : ''}
        </button>
        <button onClick={() => load(0)} className="text-xs text-blue-500 font-medium">↺</button>
      </div>

      {/* Filter bar */}
      {showFilter && (
        <div className="bg-gray-50 rounded-2xl p-3 space-y-2 border border-gray-200">
          <div className="grid grid-cols-2 gap-2">
            <input value={fUser} onChange={e => setFUser(e.target.value)} placeholder="Tên người dùng"
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
            <select value={fAction} onChange={e => setFAction(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              <option value="">— Hành động —</option>
              {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={fEntity} onChange={e => setFEntity(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              <option value="">— Đối tượng —</option>
              {['user','customer','order','quote','payment','expense','product','asset','task','maintenance','company_settings','system_config','commission','kpi'].map(e =>
                <option key={e} value={e}>{e}</option>
              )}
            </select>
            <div className="flex gap-1 items-center">
              <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex-1" />
              <span className="text-gray-400 text-xs">→</span>
              <input type="date" value={fTo} onChange={e => setFTo(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex-1" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => load(0)} className="flex-1 bg-blue-600 text-white text-xs font-semibold py-1.5 rounded-lg">
              Áp dụng
            </button>
            <button onClick={() => { setFAction(''); setFUser(''); setFEntity(''); setFFrom(''); setFTo(''); }}
              className="text-xs text-gray-500 px-3 py-1.5 rounded-lg bg-white border border-gray-200">
              Xoá bộ lọc
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-8 text-center">
          <p className="text-sm text-gray-400">Không có hoạt động nào</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{log.user_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLOR[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                    <span className="text-[10px] text-gray-400">{log.entity}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{log.detail}</p>
                </div>
                <span className="text-xs text-gray-300 flex-shrink-0 mt-0.5">{fmtTime(log.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > LIMIT && (
        <div className="flex gap-2">
          <button onClick={() => load(Math.max(0, offset - LIMIT))} disabled={offset === 0}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-3 rounded-xl disabled:opacity-40">
            ← Trước
          </button>
          <span className="flex items-center text-xs text-gray-400 px-2">
            {offset + 1}–{Math.min(offset + LIMIT, total)} / {total}
          </span>
          <button onClick={() => load(offset + LIMIT)} disabled={offset + LIMIT >= total}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-3 rounded-xl disabled:opacity-40">
            Sau →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── System Config Tab ────────────────────────────────────────────────────────

function SystemConfigTab() {
  const [n8nUrl,      setN8nUrl]      = useState('')
  const [appUrl,      setAppUrl]      = useState('')
  const [larkOk,      setLarkOk]      = useState<boolean | null>(null)
  const [larkMsg,     setLarkMsg]     = useState('')
  const [n8nOk,       setN8nOk]       = useState<boolean | null>(null)
  const [n8nMsg,      setN8nMsg]      = useState('')
  const [testing,     setTesting]     = useState<'lark' | 'n8n' | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [larkCfg,     setLarkCfg]     = useState<boolean | null>(null)
  const [success,     setSuccess]     = useState('')
  const [error,       setError]       = useState('')

  useEffect(() => {
    fetch('/api/admin/system')
      .then(r => r.json())
      .then(d => {
        setN8nUrl(d.data?.n8n_webhook_url ?? '')
        setAppUrl(d.data?.app_url ?? '')
        setLarkCfg(d.lark_configured ?? false)
      })
      .catch(() => {})
  }, [])

  const testConnection = async (which: 'lark' | 'n8n') => {
    setTesting(which)
    if (which === 'lark') { setLarkOk(null); setLarkMsg('') }
    else                  { setN8nOk(null);  setN8nMsg('') }
    try {
      const res  = await fetch(`/api/admin/system?action=test_${which}`, { method: 'POST' })
      const data = await res.json()
      if (which === 'lark') { setLarkOk(data.ok); setLarkMsg(data.message) }
      else                  { setN8nOk(data.ok);  setN8nMsg(data.message) }
    } catch {
      if (which === 'lark') { setLarkOk(false); setLarkMsg('Lỗi kết nối') }
      else                  { setN8nOk(false);  setN8nMsg('Lỗi kết nối') }
    } finally { setTesting(null) }
  }

  const handleSave = async () => {
    ;(document.activeElement as HTMLElement)?.blur()
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/admin/system', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n8n_webhook_url: n8nUrl, app_url: appUrl }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi lưu'); return }
      setSuccess('Đã lưu cấu hình')
      setTimeout(() => setSuccess(''), 3000)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  const StatusBadge = ({ ok, msg }: { ok: boolean | null; msg: string }) => {
    if (ok === null) return null
    return (
      <p className={`text-xs mt-1.5 px-3 py-1.5 rounded-lg font-medium ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
        {ok ? '✓' : '✗'} {msg}
      </p>
    )
  }

  return (
    <div className="space-y-4">

      {/* LarkBase */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">LarkBase</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {larkCfg === null ? '...' : larkCfg ? 'Tokens đã cấu hình trong môi trường' : 'Chưa cấu hình env vars'}
            </p>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${larkCfg ? 'bg-green-400' : 'bg-red-400'}`} />
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-500 font-mono space-y-1">
          <p>LARK_APP_ID · LARK_APP_SECRET · LARK_BASE_APP_TOKEN</p>
          <p className="text-gray-400">→ Cấu hình trong file .env.local hoặc hosting env vars</p>
        </div>
        <button
          onClick={() => testConnection('lark')}
          disabled={testing === 'lark'}
          className="w-full border border-blue-200 text-blue-600 text-sm font-medium py-3 rounded-xl hover:bg-blue-50 disabled:opacity-50"
        >
          {testing === 'lark' ? 'Đang kiểm tra...' : '🔌 Kiểm tra kết nối LarkBase'}
        </button>
        <StatusBadge ok={larkOk} msg={larkMsg} />
      </div>

      {/* N8n Webhook */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">N8n Webhook</p>
          <p className="text-xs text-gray-500 mt-0.5">Dùng để gửi email chào mừng nhân viên mới</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-600 mb-1 block">URL WEBHOOK</label>
          <input
            type="url"
            value={n8nUrl}
            onChange={e => setN8nUrl(e.target.value)}
            placeholder="https://n8n.yourserver.com/webhook/..."
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>
        <button
          onClick={() => testConnection('n8n')}
          disabled={testing === 'n8n' || !n8nUrl}
          className="w-full border border-blue-200 text-blue-600 text-sm font-medium py-3 rounded-xl hover:bg-blue-50 disabled:opacity-50"
        >
          {testing === 'n8n' ? 'Đang kiểm tra...' : '🔌 Kiểm tra kết nối N8n'}
        </button>
        <StatusBadge ok={n8nOk} msg={n8nMsg} />
      </div>

      {/* App URL */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">App URL</p>
          <p className="text-xs text-gray-500 mt-0.5">Gửi kèm trong email chào mừng nhân viên</p>
        </div>
        <input
          type="url"
          value={appUrl}
          onChange={e => setAppUrl(e.target.value)}
          placeholder="https://crm.yourcompany.com"
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✅ {success}</div>}
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠️ {error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl text-sm"
      >
        {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
      </button>
    </div>
  )
}

// ─── Business Rules Tab ───────────────────────────────────────────────────────

function BusinessRulesTab() {
  const [threshold,  setThreshold]  = useState('')
  const [discount,   setDiscount]   = useState('')
  const [slaDays,    setSlaDays]    = useState('')
  const [slaOverride,setSlaOverride]= useState<Record<string, string>>({ DN: '', GH: '', NT: '' })
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [success,    setSuccess]    = useState('')
  const [error,      setError]      = useState('')

  useEffect(() => {
    fetch('/api/admin/business-rules')
      .then(r => r.json())
      .then(d => {
        const r = d.rules
        if (!r) return
        setThreshold(String(r.ceo_approval_threshold ?? ''))
        setDiscount(String(r.sales_max_discount_pct ?? ''))
        setSlaDays(String(r.default_stage_sla_days ?? ''))
        const ov = r.stage_sla_override ?? {}
        setSlaOverride({ DN: String(ov.DN ?? ''), GH: String(ov.GH ?? ''), NT: String(ov.NT ?? '') })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const body: Record<string, any> = {}
      if (threshold) body.ceo_approval_threshold = Number(threshold)
      if (discount)  body.sales_max_discount_pct = Number(discount)
      if (slaDays)   body.default_stage_sla_days = Number(slaDays)
      const ov: Record<string, number> = {}
      if (slaOverride.DN) ov.DN = Number(slaOverride.DN)
      if (slaOverride.GH) ov.GH = Number(slaOverride.GH)
      if (slaOverride.NT) ov.NT = Number(slaOverride.NT)
      if (Object.keys(ov).length) body.stage_sla_override = ov

      const res = await fetch('/api/admin/business-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Lỗi lưu'); return }
      setSuccess('Đã lưu cài đặt')
      setTimeout(() => setSuccess(''), 3000)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-10"><span className="crm-spinner" /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-800">Ngưỡng duyệt hợp đồng</p>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">CEO duyệt khi HĐ ≥ (VNĐ)</label>
          <input type="number" value={threshold} onChange={e => setThreshold(e.target.value)}
            placeholder="10000000"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-xs text-gray-400 mt-1">Dưới ngưỡng này → Director duyệt</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Sale tự chiết khấu tối đa (%)</label>
          <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} min={0} max={100}
            placeholder="1"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-800">SLA mặc định mỗi stage</p>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">SLA chung (ngày)</label>
          <input type="number" value={slaDays} onChange={e => setSlaDays(e.target.value)} min={1}
            placeholder="3"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <p className="text-xs font-semibold text-gray-500">Ghi đè theo stage</p>
        {[
          { key: 'DN', label: 'Đàm phán (DN)' },
          { key: 'GH', label: 'Giao hàng (GH)' },
          { key: 'NT', label: 'Nghiệm thu (NT)' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{label}</label>
            <input type="number" value={slaOverride[key]} min={1}
              onChange={e => setSlaOverride(prev => ({ ...prev, [key]: e.target.value }))}
              placeholder="14"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        ))}
      </div>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✅ {success}</div>}
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠️ {error}</div>}
      <button onClick={handleSave} disabled={saving}
        className="w-full bg-blue-600 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl text-sm">
        {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
      </button>
    </div>
  )
}

// ─── Roles / Permission Matrix Tab ────────────────────────────────────────────

interface RoleRow {
  id: number; code: string; display_name: string; is_system: boolean
  permissions: Record<string, boolean>
}

// Nhãn ngắn tiếng Anh cho cột header — đồng bộ với roles.code trong DB
const ROLE_SHORT: Record<string, string> = {
  admin:      'Admin',
  ceo:        'CEO',
  director:   'Dir.',
  accountant: 'Acct.',
  sales:      'Sales',
  tech:       'Tech',
  logistics:  'Logi.',
}

// Keys phải khớp với permission_key trong bảng role_permissions (DB)
const PERM_GROUPS = [
  {
    label: 'Khách hàng',
    perms: [
      { key: 'VIEW_ALL_CUSTOMERS',    label: 'Xem tất cả KH'    },
      { key: 'VIEW_OWN_CUSTOMERS',    label: 'Xem KH của mình'  },
      { key: 'CREATE_CUSTOMER',       label: 'Tạo KH mới'       },
      { key: 'MANAGE_CUSTOMER',       label: 'Sửa / Xóa KH'     },
    ],
  },
  {
    label: 'Báo giá / Hợp đồng',
    perms: [
      { key: 'CREATE_QUOTE',          label: 'Tạo báo giá'        },
      { key: 'APPROVE_QUOTE',         label: 'Duyệt báo giá'      },
      { key: 'CREATE_CONTRACT',       label: 'Tạo hợp đồng'       },
      { key: 'APPROVE_CONTRACT',      label: 'Duyệt hợp đồng'     },
      { key: 'APPROVE_DISCOUNT',      label: 'Duyệt chiết khấu'   },
    ],
  },
  {
    label: 'Tasks',
    perms: [
      { key: 'START_TASK',            label: 'Bắt đầu task'        },
      { key: 'COMPLETE_OWN_TASK',     label: 'Hoàn thành task'     },
      { key: 'APPROVE_OTHERS_TASK',   label: 'Duyệt task người khác'},
      { key: 'MANAGE_BLOCKED_TASK',   label: 'Xử lý task blocked'  },
    ],
  },
  {
    label: 'Tài chính',
    perms: [
      { key: 'VIEW_FINANCIAL_DATA',   label: 'Xem tài chính'       },
      { key: 'COLLECT_PAYMENT',       label: 'Thu / nhập thanh toán'},
      { key: 'VIEW_ALL_KPI',          label: 'Xem KPI toàn đội'    },
    ],
  },
  {
    label: 'Quản trị',
    perms: [
      { key: 'MANAGE_USERS',          label: 'Quản lý nhân viên'   },
      { key: 'EDIT_SYSTEM_SETTINGS',  label: 'Cài đặt hệ thống'    },
      { key: 'EDIT_TASK_DEFINITIONS', label: 'Cấu hình task'       },
    ],
  },
]

// ─── UserPermsPanel — quản lý quyền riêng cho 1 nhân viên ────────────────────

interface StaffBrief { id: string; full_name: string; role: string }

function UserPermsPanel() {
  const [staffList,     setStaffList]     = useState<StaffBrief[]>([])
  const [selectedId,    setSelectedId]    = useState('')
  const [userPerms,     setUserPerms]     = useState<Record<string, boolean>>({})
  const [roleDefaults,  setRoleDefaults]  = useState<Record<string, boolean>>({})
  const [profile,       setProfile]       = useState<{ full_name: string; role: string } | null>(null)
  const [pending,       setPending]       = useState<{ permission_key: string; is_enabled: boolean }[]>([])
  const [loadingList,   setLoadingList]   = useState(true)
  const [loadingUser,   setLoadingUser]   = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [resetting,     setResetting]     = useState(false)
  const [success,       setSuccess]       = useState('')
  const [error,         setError]         = useState('')
  const [expanded,      setExpanded]      = useState<string>('Khách hàng')

  // Tải danh sách nhân viên (active only)
  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => {
        const list: StaffBrief[] = (d.data ?? [])
          .filter((u: StaffUser) => u.is_active)
          .map((u: StaffUser) => ({ id: u.id, full_name: u.full_name, role: u.role }))
        setStaffList(list)
      })
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }, [])

  // Tải quyền của user được chọn
  const loadUserPerms = useCallback(async (userId: string) => {
    if (!userId) return
    setLoadingUser(true); setPending([]); setError(''); setSuccess('')
    try {
      const res  = await fetch(`/api/admin/permissions?userId=${userId}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Lỗi tải quyền'); return }
      setUserPerms(data.permissions ?? {})
      setRoleDefaults(data.role_defaults ?? {})
      setProfile(data.profile ?? null)
    } catch { setError('Lỗi kết nối') }
    finally { setLoadingUser(false) }
  }, [])

  useEffect(() => {
    if (selectedId) loadUserPerms(selectedId)
  }, [selectedId, loadUserPerms])

  const togglePerm = (permKey: string, current: boolean) => {
    const next = !current
    setUserPerms(prev => ({ ...prev, [permKey]: next }))
    setPending(prev => {
      const filtered = prev.filter(p => p.permission_key !== permKey)
      return [...filtered, { permission_key: permKey, is_enabled: next }]
    })
  }

  const saveAll = async () => {
    if (!pending.length || !selectedId) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/admin/permissions', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: selectedId, updates: pending }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Lỗi lưu'); return }
      setPending([])
      setSuccess(`Đã lưu ${d.updated} quyền cho ${profile?.full_name}`)
      setTimeout(() => setSuccess(''), 3000)
      // Tải lại để đồng bộ
      loadUserPerms(selectedId)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  const resetToDefault = async () => {
    if (!selectedId) return
    setResetting(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`/api/admin/permissions?userId=${selectedId}`, { method: 'DELETE' })
      const d   = await res.json()
      if (!res.ok) { setError(d.error || 'Lỗi reset'); return }
      setSuccess(`Đã reset quyền ${profile?.full_name} về mặc định role`)
      setTimeout(() => setSuccess(''), 3000)
      setPending([])
      loadUserPerms(selectedId)
    } catch { setError('Lỗi kết nối') }
    finally { setResetting(false) }
  }

  if (loadingList) return <div className="flex justify-center py-10"><span className="crm-spinner" /></div>

  return (
    <div className="space-y-4">

      {/* Staff picker */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <label className="text-xs font-semibold text-gray-500">CHỌN NHÂN VIÊN</label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">— Chọn nhân viên —</option>
          {staffList.map(s => (
            <option key={s.id} value={s.id}>
              {s.full_name} ({ROLE_LABEL[s.role] ?? s.role})
            </option>
          ))}
        </select>
        {profile && (
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {profile.full_name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{profile.full_name}</p>
                <p className="text-xs text-gray-400">
                  {ROLE_LABEL[profile.role] ?? profile.role}
                  {pending.length > 0 && (
                    <span className="ml-2 text-amber-600">· {pending.length} thay đổi chưa lưu</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={resetToDefault}
              disabled={resetting || !selectedId}
              className="text-xs border border-orange-200 text-orange-600 px-3 py-1.5 rounded-lg hover:bg-orange-50 disabled:opacity-50"
            >
              {resetting ? '...' : '↺ Mặc định role'}
            </button>
          </div>
        )}
      </div>

      {/* Chú giải */}
      {selectedId && !loadingUser && (
        <div className="flex items-center gap-4 text-[11px] text-gray-500 px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-blue-500 inline-block" /> Có quyền
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border-2 border-gray-300 inline-block" /> Không có
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-400 inline-block" /> Đã chỉnh sửa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /> Khác role mặc định
          </span>
        </div>
      )}

      {/* Permission groups */}
      {selectedId && loadingUser ? (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
          <span className="crm-spinner" /><span>Đang tải quyền...</span>
        </div>
      ) : selectedId ? (
        <>
          {PERM_GROUPS.map(group => {
            const isOpen = expanded === group.label
            return (
              <div key={group.label} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? '' : group.label)}
                  className="w-full px-4 py-3.5 flex items-center justify-between"
                >
                  <span className="text-sm font-semibold text-gray-800">{group.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {group.perms.filter(p => userPerms[p.key]).length}/{group.perms.length}
                    </span>
                    <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-50">
                    {group.perms.map(perm => {
                      const enabled      = userPerms[perm.key] ?? false
                      const roleDefault  = roleDefaults[perm.key] ?? false
                      const differsRole  = enabled !== roleDefault
                      const isPending    = pending.some(p => p.permission_key === perm.key)

                      return (
                        <div
                          key={perm.key}
                          className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${
                            isPending ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <button
                            onClick={() => togglePerm(perm.key, enabled)}
                            className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                              enabled
                                ? isPending
                                  ? 'bg-amber-400 border-amber-400'
                                  : 'bg-blue-500 border-blue-500'
                                : isPending
                                  ? 'bg-amber-50 border-amber-300'
                                  : 'border-gray-300 bg-white'
                            }`}
                          >
                            {enabled && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700">{perm.label}</p>
                            <p className="text-[10px] font-mono text-gray-400">{perm.key}</p>
                          </div>

                          {/* Indicator: differs from role default */}
                          {differsRole && !isPending && (
                            <span
                              title={`Khác mặc định role (${roleDefault ? 'role: ✓' : 'role: ✗'})`}
                              className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0"
                            />
                          )}

                          {/* Role default badge */}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            roleDefault
                              ? 'bg-blue-50 text-blue-500'
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {roleDefault ? 'Role: ✓' : 'Role: ✗'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {pending.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
              ⚠️ Có {pending.length} thay đổi chưa lưu
            </div>
          )}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✅ {success}</div>}
          {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠️ {error}</div>}

          <button
            onClick={saveAll}
            disabled={saving || !pending.length}
            className="w-full bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-3 rounded-xl text-sm"
          >
            {saving ? 'Đang lưu...' : pending.length ? `Lưu ${pending.length} thay đổi` : 'Chưa có thay đổi'}
          </button>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-10 text-center">
          <p className="text-2xl mb-2">👆</p>
          <p className="text-sm text-gray-400">Chọn nhân viên để quản lý quyền cá nhân</p>
        </div>
      )}
    </div>
  )
}

// ─── RolesTab — wrapper with mode toggle ──────────────────────────────────────

function RolesTab() {
  const [mode,       setMode]       = useState<'role' | 'user'>('role')
  const [roles,      setRoles]      = useState<RoleRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [pending,    setPending]    = useState<{ role_id: number; permission_key: string; is_enabled: boolean }[]>([])
  const [saving,     setSaving]     = useState(false)
  const [success,    setSuccess]    = useState('')
  const [error,      setError]      = useState('')
  const [expanded,   setExpanded]   = useState<string>('Khách hàng')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/roles')
      .then(r => r.json())
      .then(d => setRoles(d.roles ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (roleId: number, permKey: string, currentEnabled: boolean) => {
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r
      return { ...r, permissions: { ...r.permissions, [permKey]: !currentEnabled } }
    }))
    setPending(prev => {
      const filtered = prev.filter(p => !(p.role_id === roleId && p.permission_key === permKey))
      return [...filtered, { role_id: roleId, permission_key: permKey, is_enabled: !currentEnabled }]
    })
  }

  const saveAll = async () => {
    if (!pending.length) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: pending }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Lỗi lưu'); return }
      setPending([])
      setSuccess(`Đã lưu ${d.updated} thay đổi`)
      setTimeout(() => setSuccess(''), 3000)
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(false) }
  }

  const visibleRoles = roles.filter(r => ['admin','ceo','director','accountant','sales','tech','logistics'].includes(r.code))

  return (
    <div className="space-y-4">

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setMode('role')}
          className={`py-2 rounded-lg text-xs font-semibold transition-all ${
            mode === 'role' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
          }`}
        >
          🔑 Vai trò mặc định
        </button>
        <button
          onClick={() => setMode('user')}
          className={`py-2 rounded-lg text-xs font-semibold transition-all ${
            mode === 'user' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
          }`}
        >
          👤 Cá nhân
        </button>
      </div>

      {/* User mode */}
      {mode === 'user' && <UserPermsPanel />}

      {/* Role matrix mode */}
      {mode === 'role' && (
        <>
          <p className="text-xs text-gray-500">
            Quyền mặc định cho từng vai trò. Tích để cấp, thay đổi chưa lưu hiển thị màu vàng.
          </p>

          {loading ? (
            <div className="flex justify-center py-10"><span className="crm-spinner" /></div>
          ) : (
            <>
              {PERM_GROUPS.map(group => {
                const isOpen = expanded === group.label
                return (
                  <div key={group.label} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? '' : group.label)}
                      className="w-full px-4 py-3.5 flex items-center justify-between"
                    >
                      <span className="text-sm font-semibold text-gray-800">{group.label}</span>
                      <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-50 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-50">
                              <th className="text-left px-4 py-2 text-gray-400 font-medium w-32">Quyền</th>
                              {visibleRoles.map(r => (
                                <th key={r.id} className="px-2 py-2 text-center text-gray-500 font-medium min-w-[48px]">
                                  {ROLE_SHORT[r.code] ?? r.code}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.perms.map(perm => (
                              <tr key={perm.key} className="border-b border-gray-50 last:border-0">
                                <td className="px-4 py-2.5 text-gray-600">{perm.label}</td>
                                {visibleRoles.map(role => {
                                  const enabled   = role.permissions[perm.key] ?? false
                                  const isPending = pending.some(p => p.role_id === role.id && p.permission_key === perm.key)
                                  return (
                                    <td key={role.id} className="px-2 py-2.5 text-center">
                                      <button
                                        onClick={() => toggle(role.id, perm.key, enabled)}
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all ${
                                          enabled
                                            ? isPending
                                              ? 'bg-amber-400 border-amber-400'
                                              : 'bg-blue-500 border-blue-500'
                                            : isPending
                                              ? 'bg-amber-50 border-amber-300'
                                              : 'border-gray-300 bg-white'
                                        }`}
                                      >
                                        {enabled && (
                                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </button>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}

              {pending.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                  ⚠️ Có {pending.length} thay đổi chưa lưu
                </div>
              )}
              {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✅ {success}</div>}
              {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠️ {error}</div>}

              <button onClick={saveAll} disabled={saving || !pending.length}
                className="w-full bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-3 rounded-xl text-sm">
                {saving ? 'Đang lưu...' : pending.length ? `Lưu ${pending.length} thay đổi` : 'Chưa có thay đổi'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tasks Catalog Tab ────────────────────────────────────────────────────────

interface TaskDef {
  id: number; stage_code: string; stage_label: string; task_key: string
  label: string; bo_phan: string; task_type: string; requires_attachment: boolean
  sort_order: number; is_active: boolean; roles_can_update: string[]; roles_can_approve: string[]
}

const ROLES_ALL = ['admin','ceo','director','sales','tech','logistics','accountant','partner']
const BO_PHAN_OPTIONS = ['KD','KT','KTO','BLD']

function TasksTab() {
  const [tasks,   setTasks]   = useState<TaskDef[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling,setToggling]= useState<Set<number>>(new Set())
  const [success, setSuccess] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addSaving,   setAddSaving]   = useState(false)
  const [addErr,      setAddErr]      = useState('')
  const [newTask, setNewTask] = useState({
    stage_code: '', stage_label: '', task_key: '', label: '', bo_phan: 'KD',
    roles_can_update: ['tech','sales'], roles_can_approve: ['admin','ceo'],
  })

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/task-definitions?active_only=false')
      .then(r => r.json())
      .then(d => setTasks(d.tasks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const toggleActive = async (task: TaskDef) => {
    setToggling(prev => new Set(prev).add(task.id))
    try {
      const res = await fetch(`/api/admin/task-definitions?id=${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !task.is_active }),
      })
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_active: !t.is_active } : t))
        setSuccess(`${!task.is_active ? 'Bật' : 'Tắt'} task: ${task.label}`)
        setTimeout(() => setSuccess(''), 2500)
      }
    } catch {}
    finally { setToggling(prev => { const s = new Set(prev); s.delete(task.id); return s }) }
  }

  const handleAddTask = async () => {
    if (!newTask.stage_code || !newTask.task_key || !newTask.label) {
      setAddErr('Cần nhập: Mã stage, Mã task, Tên task'); return
    }
    setAddSaving(true); setAddErr('')
    try {
      const res = await fetch('/api/admin/task-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          stage_label: newTask.stage_label || newTask.stage_code,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddErr(data.error || 'Lỗi tạo task'); return }
      setTasks(prev => [...prev, data.task])
      setSuccess(`Đã thêm task: ${newTask.label}`)
      setTimeout(() => setSuccess(''), 2500)
      setShowAddForm(false)
      setNewTask({ stage_code: '', stage_label: '', task_key: '', label: '', bo_phan: 'KD', roles_can_update: ['tech','sales'], roles_can_approve: ['admin','ceo'] })
    } catch { setAddErr('Lỗi kết nối') }
    finally { setAddSaving(false) }
  }

  const toggleRole = (field: 'roles_can_update' | 'roles_can_approve', role: string) => {
    setNewTask(t => {
      const arr = t[field]
      return { ...t, [field]: arr.includes(role) ? arr.filter(r => r !== role) : [...arr, role] }
    })
  }

  const displayed = showAll ? tasks : tasks.filter(t => t.is_active)
  const grouped   = displayed.reduce<Record<string, TaskDef[]>>((acc, t) => {
    if (!acc[t.stage_code]) acc[t.stage_code] = []
    acc[t.stage_code].push(t)
    return acc
  }, {})

  const BO_PHAN_COLOR: Record<string, string> = {
    KD: 'bg-green-100 text-green-700',
    KT: 'bg-blue-100 text-blue-700',
    KTO:'bg-teal-100 text-teal-700',
    BLD:'bg-purple-100 text-purple-700',
  }

  if (loading) return <div className="flex justify-center py-10"><span className="crm-spinner" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{tasks.filter(t => t.is_active).length}/{tasks.length} task đang bật</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddForm(p => !p)}
            className="text-xs text-green-600 font-semibold bg-green-50 px-3 py-1.5 rounded-lg">
            {showAddForm ? 'Đóng' : '+ Thêm task'}
          </button>
          <button onClick={() => setShowAll(p => !p)}
            className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg">
            {showAll ? 'Chỉ hiện đang bật' : 'Hiện tất cả'}
          </button>
        </div>
      </div>

      {/* Form thêm task mới */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-green-100 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Thêm task định nghĩa mới</p>
          {addErr && <p className="text-xs text-red-500">{addErr}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">MÃ STAGE *</label>
              <input value={newTask.stage_code} onChange={e => setNewTask(t => ({ ...t, stage_code: e.target.value.toUpperCase() }))}
                placeholder="C1, B2, D3..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">TÊN STAGE</label>
              <input value={newTask.stage_label} onChange={e => setNewTask(t => ({ ...t, stage_label: e.target.value }))}
                placeholder="Tiếp cận KH..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">TÊN TASK *</label>
            <input value={newTask.label} onChange={e => setNewTask(t => ({ ...t, label: e.target.value }))}
              placeholder="Gửi báo giá cho khách hàng" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">MÃ TASK * (duy nhất)</label>
              <input value={newTask.task_key} onChange={e => setNewTask(t => ({ ...t, task_key: e.target.value.toUpperCase().replace(/\s/g, '_') }))}
                placeholder="KD_C1_GUI_BG" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">BỘ PHẬN *</label>
              <select value={newTask.bo_phan} onChange={e => setNewTask(t => ({ ...t, bo_phan: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {BO_PHAN_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ROLES THỰC HIỆN</label>
            <div className="flex flex-wrap gap-2">
              {ROLES_ALL.map(r => (
                <button key={r} type="button"
                  onClick={() => toggleRole('roles_can_update', r)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${newTask.roles_can_update.includes(r) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ROLES PHÊ DUYỆT</label>
            <div className="flex flex-wrap gap-2">
              {ROLES_ALL.map(r => (
                <button key={r} type="button"
                  onClick={() => toggleRole('roles_can_approve', r)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${newTask.roles_can_approve.includes(r) ? 'bg-purple-100 border-purple-300 text-purple-700' : 'border-gray-200 text-gray-500'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleAddTask} disabled={addSaving}
            className="w-full bg-green-600 disabled:bg-green-300 text-white font-medium py-2.5 rounded-xl text-sm">
            {addSaving ? 'Đang lưu...' : 'Tạo task'}
          </button>
        </div>
      )}

      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✅ {success}</div>}

      {Object.entries(grouped).map(([stage, stageTasks]) => (
        <div key={stage} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-800">{stageTasks[0]?.stage_label ?? stage}</span>
              <span className="text-xs text-gray-400 ml-2">[{stage}]</span>
            </div>
            <span className="text-xs text-gray-400">{stageTasks.filter(t=>t.is_active).length}/{stageTasks.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {stageTasks.map(task => (
              <div key={task.id} className={`flex items-start gap-3 px-4 py-3 ${!task.is_active ? 'opacity-50' : ''}`}>
                <button
                  onClick={() => toggleActive(task)}
                  disabled={toggling.has(task.id)}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    task.is_active ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'
                  }`}
                >
                  {toggling.has(task.id) ? (
                    <span className="crm-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                  ) : task.is_active ? (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-snug">{task.label}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-mono text-gray-400">{task.task_key}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${BO_PHAN_COLOR[task.bo_phan] ?? 'bg-gray-100 text-gray-600'}`}>
                      {task.bo_phan}
                    </span>
                    {task.task_type !== 'mandatory' && (
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {task.task_type === 'optional' ? 'tuỳ chọn' : 'điều kiện'}
                      </span>
                    )}
                    {task.requires_attachment && (
                      <span className="text-[10px] text-orange-500">📎</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Pipeline Config Tab ──────────────────────────────────────────────────────

interface PipelineCfg {
  order_type: string; display_name: string; stages: string[]
  stage_labels: string[]; is_active: boolean; description: string | null
}

function PipelineTab() {
  const [configs,  setConfigs]  = useState<PipelineCfg[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [success,  setSuccess]  = useState('')
  const [error,    setError]    = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/pipeline-config')
      .then(r => r.json())
      .then(d => setConfigs(d.configs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const toggleActive = async (cfg: PipelineCfg) => {
    setSaving(cfg.order_type); setError('')
    try {
      const res = await fetch(`/api/admin/pipeline-config?order_type=${encodeURIComponent(cfg.order_type)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cfg.is_active }),
      })
      if (res.ok) {
        setConfigs(prev => prev.map(c =>
          c.order_type === cfg.order_type ? { ...c, is_active: !c.is_active } : c
        ))
        setSuccess(`${!cfg.is_active ? 'Bật' : 'Tắt'} pipeline: ${cfg.display_name}`)
        setTimeout(() => setSuccess(''), 2500)
      }
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(null) }
  }

  const ORDER_TYPE_COLOR: Record<string, string> = {
    B2C:        'bg-blue-100 text-blue-700',
    Thuong_mai: 'bg-green-100 text-green-700',
    Du_an:      'bg-purple-100 text-purple-700',
  }

  if (loading) return <div className="flex justify-center py-10"><span className="crm-spinner" /></div>

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Kích hoạt / tắt từng loại pipeline. Mỗi loại có bộ stages riêng.</p>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✅ {success}</div>}
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠️ {error}</div>}

      {configs.map(cfg => (
        <div key={cfg.order_type} className={`bg-white rounded-2xl border overflow-hidden ${
          cfg.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'
        }`}>
          <div className="px-4 py-4 flex items-start gap-3">
            {/* Toggle */}
            <button
              onClick={() => toggleActive(cfg)}
              disabled={saving === cfg.order_type}
              className={`mt-0.5 w-11 h-6 rounded-full flex-shrink-0 transition-colors relative ${
                cfg.is_active ? 'bg-green-500' : 'bg-gray-200'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                cfg.is_active ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-800">{cfg.display_name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ORDER_TYPE_COLOR[cfg.order_type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {cfg.order_type}
                </span>
              </div>
              {cfg.description && (
                <p className="text-xs text-gray-500 mb-2">{cfg.description}</p>
              )}
              {/* Stages list */}
              <div className="flex flex-wrap gap-1">
                {cfg.stage_labels?.map((label, i) => (
                  <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {i + 1}. {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
        ℹ️ Để chỉnh sửa stages trong từng pipeline, vui lòng liên hệ Admin hệ thống. Thay đổi stages có thể ảnh hưởng dữ liệu hiện tại.
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab,          setTab]          = useState<'users' | 'company' | 'audit' | 'system' | 'business' | 'roles' | 'tasks' | 'pipeline'>('users')
  const [users,        setUsers]        = useState<StaffUser[]>([])
  const [loading,      setLoading]      = useState(true)
  const [myId,         setMyId]         = useState('')
  const [successMsg,   setSuccessMsg]   = useState('')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [roleTarget,   setRoleTarget]   = useState<StaffUser | null>(null)
  const [deactTarget,  setDeactTarget]  = useState<StaffUser | null>(null)
  const [resetPwdTarget, setResetPwdTarget] = useState<StaffUser | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [tempPwdInfo,  setTempPwdInfo]  = useState<{ email: string; pwd: string; title?: string } | null>(null)
  const [unlockTarget, setUnlockTarget] = useState<StaffUser | null>(null)
  const [unlocking,    setUnlocking]    = useState(false)
  const [statusFilter, setStatusFilter]  = useState<string[]>(['Đang làm'])
  const supabase = createClient()

  const notify = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg); else setSuccessMsg(msg)
    setTimeout(() => { setSuccessMsg(''); setErrorMsg('') }, 4000)
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setMyId(user.id)

      const res = await fetch('/api/admin/users')
      const data = await res.json()
      setUsers(data.data ?? [])
    } catch {
      notify('Lỗi tải danh sách user', true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Danh sách có thể nhận bàn giao khi khoá tài khoản
  const managers = users.filter(u => ['admin', 'ceo', 'director'].includes(u.role))

  const STATUS_LIST = ['Đang làm', 'Thử việc', 'Tạm nghỉ', 'Nghỉ việc']
  const isAll = statusFilter.length === STATUS_LIST.length

  const displayed = users.filter(u =>
    isAll ? true : statusFilter.includes(u.trang_thai_nv ?? 'Đang làm')
  )

  const statusCounts = STATUS_LIST.reduce<Record<string, number>>((acc, s) => {
    acc[s] = users.filter(u => (u.trang_thai_nv ?? 'Đang làm') === s).length
    return acc
  }, {})

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-800">Quản trị hệ thống</h1>
        <p className="text-xs text-gray-500">
          {users.length} tài khoản · {statusCounts['Đang làm'] ?? 0} đang làm · {statusCounts['Nghỉ việc'] ?? 0} đã nghỉ
        </p>
      </div>

      {/* Tab switcher — 4x2 grid */}
      <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-xl">
        {([
          { key: 'users',    label: '👥 Users'    },
          { key: 'roles',    label: '🔑 Quyền'    },
          { key: 'tasks',    label: '✅ Tasks'    },
          { key: 'pipeline', label: '🔀 Pipeline' },
          { key: 'business', label: '📐 Rules'    },
          { key: 'company',  label: '🏢 Công ty'  },
          { key: 'audit',    label: '📋 Nhật ký'  },
          { key: 'system',   label: '⚙️ Hệ thống' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2 rounded-lg text-[10px] font-semibold transition-all leading-tight ${
              tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company'  && <CompanySettingsTab />}
      {tab === 'audit'    && <AuditLogTab />}
      {tab === 'system'   && <SystemConfigTab />}
      {tab === 'business' && <BusinessRulesTab />}
      {tab === 'roles'    && <RolesTab />}
      {tab === 'tasks'    && <TasksTab />}
      {tab === 'pipeline' && <PipelineTab />}

      {/* Users tab content */}
      {tab === 'users' && <>

      {/* Nút thêm nhân viên */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 transition-colors"
      >
        <span className="text-lg leading-none">＋</span> Thêm nhân viên mới
      </button>

      {/* Thông báo */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
          ✅ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Filter theo trạng thái nhân viên */}
      <div className="flex flex-wrap gap-2">
        {/* Nút Tất cả */}
        <button
          onClick={() => setStatusFilter([...STATUS_LIST])}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            isAll ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          Tất cả ({users.length})
        </button>

        {/* Nút từng trạng thái */}
        {([
          { key: 'Đang làm',  color: 'bg-green-500',  active: 'bg-green-500 text-white',  inactive: 'bg-green-50 text-green-700'  },
          { key: 'Thử việc',  color: 'bg-blue-500',   active: 'bg-blue-500 text-white',   inactive: 'bg-blue-50 text-blue-700'    },
          { key: 'Tạm nghỉ',  color: 'bg-yellow-500', active: 'bg-yellow-500 text-white', inactive: 'bg-yellow-50 text-yellow-700'},
          { key: 'Nghỉ việc', color: 'bg-red-500',    active: 'bg-red-500 text-white',    inactive: 'bg-red-50 text-red-600'      },
        ]).map(s => {
          const selected = !isAll && statusFilter.includes(s.key)
          const count = statusCounts[s.key] ?? 0
          return (
            <button
              key={s.key}
              onClick={() => {
                if (isAll) {
                  // Bỏ "Tất cả", chỉ chọn cái này
                  setStatusFilter([s.key])
                } else if (selected) {
                  // Bỏ chọn — nhưng không cho bỏ hết
                  const next = statusFilter.filter(x => x !== s.key)
                  setStatusFilter(next.length ? next : [s.key])
                } else {
                  setStatusFilter([...statusFilter, s.key])
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selected ? s.active : s.inactive
              }`}
            >
              {s.key}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                selected ? 'bg-white/30' : 'bg-white/60'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Chú thích quyền */}
      <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-blue-700">Phân quyền hệ thống</p>
        <div className="text-xs text-blue-600 space-y-0.5">
          <p>• <strong>Quản trị viên:</strong> Toàn quyền — quản lý user, phân quyền, cấu hình hệ thống</p>
          <p>• <strong>Giám đốc / Phó GĐ:</strong> Duyệt HĐ/BG, xem toàn bộ dữ liệu, duyệt task</p>
          <p>• <strong>Kinh doanh:</strong> Khách hàng, báo giá, đơn hàng (khu vực của mình)</p>
          <p>• <strong>Kỹ thuật:</strong> Checklist kỹ thuật, bảo hành/bảo trì (được phân công)</p>
          <p>• <strong>Kế toán:</strong> Xem + nhập thanh toán, xem đơn hàng toàn hệ thống</p>
          <p>• <strong>Hậu cần:</strong> Xem đơn hàng, quản lý giao hàng</p>
        </div>
      </div>

      {/* Danh sách user */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2">
          <span className="text-4xl">👥</span>
          <p className="text-sm font-medium text-gray-500">Không có tài khoản nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(u => {
            const isMe = u.id === myId
            return (
              <div
                key={u.id}
                className={`bg-white rounded-2xl border p-4 space-y-3 ${
                  u.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'
                }`}
              >
                {/* Top row: avatar + info + status */}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold ${
                    u.is_active ? 'bg-blue-600' : 'bg-gray-400'
                  }`}>
                    {initials(u.full_name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-gray-800 text-sm">{u.full_name}</p>
                      {isMe && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">Bạn</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    {u.phone && <p className="text-xs text-gray-500">{u.phone}</p>}
                  </div>

                  <div className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                    u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.is_active ? 'Đang làm' : 'Đã khoá'}
                  </div>
                </div>

                {/* Role + WBS info */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    ROLE_COLOR[u.role] ?? 'bg-gray-100 text-gray-600'
                  }`}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                  {u.khu_vuc && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {u.khu_vuc === 'CN' ? 'Cả nước' : u.khu_vuc === 'MN' ? 'Miền Nam' : u.khu_vuc === 'MB' ? 'Miền Bắc' : u.khu_vuc === 'MT' ? 'Miền Trung' : u.khu_vuc}
                    </span>
                  )}
                  {u.ma_nv && (
                    <span className="text-[10px] font-mono text-gray-400">{u.ma_nv}</span>
                  )}
                  <span className="text-xs text-gray-300 ml-auto">
                    {new Date(u.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                {/* Actions — chỉ hiện nếu không phải chính mình */}
                {!isMe && u.is_active && (
                  <div className="flex gap-2 pt-1 border-t border-gray-50 flex-wrap">
                    <button
                      onClick={() => setRoleTarget(u)}
                      className="flex-1 border border-blue-200 text-blue-600 text-xs font-semibold py-2 rounded-xl hover:bg-blue-50"
                    >
                      ✏️ Đổi vai trò
                    </button>
                    <button
                      onClick={() => setResetPwdTarget(u)}
                      className="flex-1 border border-amber-200 text-amber-600 text-xs font-semibold py-2 rounded-xl hover:bg-amber-50"
                    >
                      🔑 Đặt lại MK
                    </button>
                    <button
                      onClick={() => setDeactTarget(u)}
                      className="w-full border border-red-200 text-red-500 text-xs font-semibold py-2 rounded-xl hover:bg-red-50"
                    >
                      🔒 Khoá tài khoản
                    </button>
                  </div>
                )}

                {/* User đã bị khoá — nút mở khoá */}
                {!isMe && !u.is_active && (
                  <div className="flex gap-2 pt-1 border-t border-gray-50">
                    <p className="flex-1 text-xs text-gray-400 self-center">Tài khoản đã khoá</p>
                    <button
                      onClick={() => setUnlockTarget(u)}
                      className="border border-green-200 text-green-600 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-green-50"
                    >
                      🔓 Mở khoá
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {roleTarget && (
        <ChangeRoleSheet
          target={roleTarget}
          onClose={() => setRoleTarget(null)}
          onDone={msg => { setRoleTarget(null); notify(msg); loadUsers() }}
        />
      )}

      {deactTarget && (
        <DeactivateModal
          target={deactTarget}
          managers={managers}
          onClose={() => setDeactTarget(null)}
          onDone={msg => { setDeactTarget(null); notify(msg); loadUsers() }}
        />
      )}

      {resetPwdTarget && (
        <ResetPasswordModal
          target={resetPwdTarget}
          onClose={() => setResetPwdTarget(null)}
          onDone={(email, pwd) => {
            setResetPwdTarget(null)
            setTempPwdInfo({ email, pwd, title: 'Đặt lại mật khẩu thành công' })
          }}
        />
      )}

      {showCreate && (
        <CreateUserSheet
          onClose={() => setShowCreate(false)}
          onDone={(_, tempPwd, email) => {
            setShowCreate(false)
            setTempPwdInfo({ email, pwd: tempPwd })
            loadUsers()
          }}
        />
      )}

      {tempPwdInfo && (
        <TempPasswordToast
          email={tempPwdInfo.email}
          tempPwd={tempPwdInfo.pwd}
          title={tempPwdInfo.title}
          onClose={() => setTempPwdInfo(null)}
        />
      )}

      {unlockTarget && (
        <UnlockConfirmModal
          target={unlockTarget}
          confirming={unlocking}
          onClose={() => setUnlockTarget(null)}
          onConfirm={async () => {
            setUnlocking(true)
            try {
              const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: unlockTarget.id, trang_thai_nv: 'Đang làm' }),
              })
              if (res.ok) {
                setUnlockTarget(null)
                notify(`Đã mở khoá ${unlockTarget.full_name}`)
                loadUsers()
              } else {
                const d = await res.json()
                notify(d.error || 'Lỗi mở khoá', true)
              }
            } catch {
              notify('Lỗi kết nối', true)
            } finally {
              setUnlocking(false)
            }
          }}
        />
      )}

      </> /* end users tab */}
    </div>
  )
}
