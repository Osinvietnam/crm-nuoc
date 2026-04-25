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
  department: string
  chuc_vu: string
  khu_vuc: string
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
  { value: 'director',   label: 'Phó Giám đốc / KT'   },
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
  director:   'Phó Giám đốc / KT',
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
  const [form,         setForm]         = useState<CompanySettings>({ name: '', address: '', phone: '', email: '', tax: '', website: '', logo_url: '' })
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

  const textFields: { key: keyof CompanySettings; label: string; placeholder: string; type?: string }[] = [
    { key: 'name',    label: 'TÊN CÔNG TY *',   placeholder: 'Công ty TNHH GWS Việt Nam' },
    { key: 'address', label: 'ĐỊA CHỈ',          placeholder: '123 Nguyễn Văn Linh, Q7, TP.HCM' },
    { key: 'phone',   label: 'SỐ ĐIỆN THOẠI',    placeholder: '028 1234 5678' },
    { key: 'email',   label: 'EMAIL',             placeholder: 'info@gws.com.vn', type: 'email' },
    { key: 'tax',     label: 'MÃ SỐ THUẾ',       placeholder: '0312345678' },
    { key: 'website', label: 'WEBSITE',           placeholder: 'https://gws.com.vn' },
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

      {/* Text fields */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        {textFields.map(f => (
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
  role_changed:       'Đổi vai trò',
  user_deactivated:   'Khoá tài khoản',
  user_reactivated:   'Mở khoá tài khoản',
  settings_updated:   'Cập nhật cài đặt',
  logo_updated:       'Cập nhật logo',
  logo_deleted:       'Xoá logo',
  quote_status_changed: 'Đổi trạng thái báo giá',
}

const ACTION_COLOR: Record<string, string> = {
  role_changed:       'bg-blue-100 text-blue-700',
  user_deactivated:   'bg-red-100 text-red-700',
  user_reactivated:   'bg-green-100 text-green-700',
  settings_updated:   'bg-purple-100 text-purple-700',
  logo_updated:       'bg-orange-100 text-orange-700',
  logo_deleted:       'bg-gray-100 text-gray-600',
  quote_status_changed: 'bg-amber-100 text-amber-700',
}

function AuditLogTab() {
  const [logs,    setLogs]    = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total,   setTotal]   = useState(0)
  const [offset,  setOffset]  = useState(0)
  const LIMIT = 20

  const load = async (off = 0) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/audit?limit=${LIMIT}&offset=${off}`)
      const data = await res.json()
      setLogs(data.data ?? [])
      setTotal(data.total ?? 0)
      setOffset(off)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load(0) }, [])

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{total} hoạt động được ghi nhận</p>
        <button onClick={() => load(0)} className="text-xs text-blue-500 font-medium">Làm mới</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-8 text-center">
          <p className="text-sm text-gray-400">Chưa có hoạt động nào được ghi nhận</p>
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
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{log.detail}</p>
                </div>
                <span className="text-xs text-gray-300 flex-shrink-0 mt-0.5">{fmtTime(log.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Phân trang */}
      {total > LIMIT && (
        <div className="flex gap-2">
          <button
            onClick={() => load(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-3 rounded-xl disabled:opacity-40"
          >
            ← Trước
          </button>
          <span className="flex items-center text-xs text-gray-400 px-2">
            {offset + 1}–{Math.min(offset + LIMIT, total)} / {total}
          </span>
          <button
            onClick={() => load(offset + LIMIT)}
            disabled={offset + LIMIT >= total}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-3 rounded-xl disabled:opacity-40"
          >
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

const PERM_GROUPS = [
  {
    label: 'Khách hàng',
    perms: [
      { key: 'VIEW_CUSTOMERS',    label: 'Xem KH'       },
      { key: 'EDIT_CUSTOMERS',    label: 'Sửa KH'       },
      { key: 'DELETE_CUSTOMERS',  label: 'Xóa KH'       },
    ],
  },
  {
    label: 'Đơn hàng / Báo giá',
    perms: [
      { key: 'VIEW_ORDERS',       label: 'Xem đơn'      },
      { key: 'CREATE_ORDER',      label: 'Tạo đơn'      },
      { key: 'APPROVE_ORDER',     label: 'Duyệt đơn'    },
    ],
  },
  {
    label: 'Tasks',
    perms: [
      { key: 'UPDATE_OWN_TASK',   label: 'Cập nhật task' },
      { key: 'APPROVE_OTHERS_TASK',label: 'Duyệt task'  },
    ],
  },
  {
    label: 'Tài chính',
    perms: [
      { key: 'VIEW_PAYMENTS',     label: 'Xem TT'       },
      { key: 'MANAGE_PAYMENTS',   label: 'Quản lý TT'   },
    ],
  },
  {
    label: 'Quản trị',
    perms: [
      { key: 'MANAGE_USERS',      label: 'Quản lý user' },
      { key: 'MANAGE_ROLES',      label: 'Phân quyền'   },
      { key: 'VIEW_AUDIT_LOG',    label: 'Xem nhật ký'  },
      { key: 'MANAGE_PIPELINE',   label: 'Cấu hình pipeline' },
      { key: 'MANAGE_TASKS',      label: 'Cấu hình task'},
      { key: 'MANAGE_SETTINGS',   label: 'Cài đặt hệ thống' },
    ],
  },
]

function RolesTab() {
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
    // Update UI optimistically
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r
      return { ...r, permissions: { ...r.permissions, [permKey]: !currentEnabled } }
    }))
    // Queue update
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

  // Only show roles that users can actually see (not partner/system roles in a simple view)
  const visibleRoles = roles.filter(r => ['admin','ceo','director','accountant','sales','tech','logistics'].includes(r.code))

  if (loading) return <div className="flex justify-center py-10"><span className="crm-spinner" /></div>

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Tích để cấp quyền. Thay đổi chưa lưu hiển thị màu vàng.</p>

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
                          {r.display_name.split(' ').pop()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.perms.map(perm => (
                      <tr key={perm.key} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2.5 text-gray-600">{perm.label}</td>
                        {visibleRoles.map(role => {
                          const enabled    = role.permissions[perm.key] ?? false
                          const isPending  = pending.some(p => p.role_id === role.id && p.permission_key === perm.key)
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
    </div>
  )
}

// ─── Tasks Catalog Tab ────────────────────────────────────────────────────────

interface TaskDef {
  id: number; stage_code: string; stage_label: string; task_key: string
  label: string; bo_phan: string; task_type: string; requires_attachment: boolean
  sort_order: number; is_active: boolean; roles_can_update: string[]; roles_can_approve: string[]
}

function TasksTab() {
  const [tasks,   setTasks]   = useState<TaskDef[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling,setToggling]= useState<Set<number>>(new Set())
  const [success, setSuccess] = useState('')
  const [showAll, setShowAll] = useState(false)

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
        <button onClick={() => setShowAll(p => !p)}
          className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg">
          {showAll ? 'Chỉ hiện đang bật' : 'Hiện tất cả'}
        </button>
      </div>

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
  const [filter,       setFilter]       = useState<'all' | 'active' | 'inactive'>('all')
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

  // Danh sách admin + manager để bàn giao khi deactivate
  const managers = users.filter(u => ['admin', 'manager'].includes(u.role))

  const displayed = users.filter(u =>
    filter === 'all'      ? true :
    filter === 'active'   ? u.is_active :
    !u.is_active
  )

  const activeCount   = users.filter(u => u.is_active).length
  const inactiveCount = users.filter(u => !u.is_active).length

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-800">Quản trị hệ thống</h1>
        <p className="text-xs text-gray-500">
          {users.length} tài khoản · {activeCount} đang hoạt động · {inactiveCount} đã khoá
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

      {/* Filter tabs */}
      <div className="flex gap-2">
        {([
          { key: 'all',      label: `Tất cả (${users.length})`     },
          { key: 'active',   label: `Đang dùng (${activeCount})`   },
          { key: 'inactive', label: `Đã khoá (${inactiveCount})`   },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chú thích quyền */}
      <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-blue-700">Phân quyền hệ thống</p>
        <div className="text-xs text-blue-600 space-y-0.5">
          <p>• <strong>Quản trị viên:</strong> Toàn quyền — quản lý user, đổi role, khoá tài khoản</p>
          <p>• <strong>Quản lý:</strong> Tạo nhân viên, quản lý sản phẩm, xem toàn bộ dữ liệu</p>
          <p>• <strong>Kinh doanh:</strong> Khách hàng, báo giá, đơn hàng (chỉ dữ liệu của mình)</p>
          <p>• <strong>Kỹ thuật:</strong> Lịch bảo trì (chỉ công việc được phân)</p>
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

                {/* Role + department */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    ROLE_COLOR[u.role] ?? 'bg-gray-100 text-gray-600'
                  }`}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                  {u.department && (
                    <span className="text-xs text-gray-500">{u.department}</span>
                  )}
                  <span className="text-xs text-gray-300 ml-auto">
                    {new Date(u.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                {/* Actions — chỉ hiện nếu không phải chính mình */}
                {!isMe && u.is_active && (
                  <div className="flex gap-2 pt-1 border-t border-gray-50">
                    <button
                      onClick={() => setRoleTarget(u)}
                      className="flex-1 border border-blue-200 text-blue-600 text-xs font-semibold py-2 rounded-xl hover:bg-blue-50"
                    >
                      ✏️ Đổi vai trò
                    </button>
                    <button
                      onClick={() => setDeactTarget(u)}
                      className="flex-1 border border-red-200 text-red-500 text-xs font-semibold py-2 rounded-xl hover:bg-red-50"
                    >
                      🔒 Khoá tài khoản
                    </button>
                  </div>
                )}

                {/* User đã bị khoá — không có action */}
                {!isMe && !u.is_active && (
                  <div className="pt-1 border-t border-gray-50">
                    <p className="text-xs text-gray-500 text-center py-1">Tài khoản đã khoá · không thể đăng nhập</p>
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

      </> /* end users tab */}
    </div>
  )
}
