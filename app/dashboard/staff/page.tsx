'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'sales',      label: 'Kinh doanh'       },
  { value: 'tech',       label: 'Kỹ thuật'          },
  { value: 'logistics',  label: 'Hậu cần'           },
  { value: 'tech_lead',  label: 'Trưởng phòng KT'   },
  { value: 'accountant', label: 'Kế toán'            },
  { value: 'ceo',        label: 'Giám đốc'           },
  { value: 'admin',      label: 'Quản trị viên'      },
  { value: 'partner',    label: 'Đối tác'            },
]

const ROLE_LABEL: Record<string, string> = {
  admin:      'Quản trị viên',
  ceo:        'Giám đốc',
  tech_lead:  'Trưởng phòng KT',
  accountant: 'Kế toán',
  sales:      'Kinh doanh',
  tech:       'Kỹ thuật',
  logistics:  'Hậu cần',
  partner:    'Đối tác',
}

const ROLE_COLOR: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-700',
  ceo:        'bg-indigo-100 text-indigo-700',
  tech_lead:  'bg-orange-100 text-orange-700',
  accountant: 'bg-teal-100 text-teal-700',
  sales:      'bg-green-100 text-green-700',
  tech:       'bg-amber-100 text-amber-700',
  logistics:  'bg-cyan-100 text-cyan-700',
  partner:    'bg-gray-100 text-gray-600',
}

const STATUS_OPTIONS = ['Đang làm', 'Thử việc', 'Tạm nghỉ', 'Nghỉ việc']

const STATUS_COLOR: Record<string, string> = {
  'Đang làm': 'bg-green-100 text-green-700',
  'Thử việc': 'bg-blue-100 text-blue-700',
  'Tạm nghỉ': 'bg-yellow-100 text-yellow-700',
  'Nghỉ việc': 'bg-red-100 text-red-600',
}

const KHU_VUC_OPTIONS = ['Miền Nam', 'Miền Bắc', 'Miền Trung']

// ─── Types ────────────────────────────────────────────────────────────────────

interface Staff {
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [editId,        setEditId]        = useState<string | null>(null)
  const [editForm,      setEditForm]      = useState<Partial<Staff>>({})
  const [saving,        setSaving]        = useState(false)
  const [resetId,       setResetId]       = useState<string | null>(null)
  const [resetPass,     setResetPass]     = useState('')
  const [resetSaving,   setResetSaving]   = useState(false)
  const [resetMsg,      setResetMsg]      = useState('')
  const [myRole,        setMyRole]        = useState('')
  const [form, setForm] = useState({
    full_name:    '',
    email:        '',
    phone:        '',
    department:   '',
    chuc_vu:      '',
    khu_vuc:      '',
    target_thang: '',
    ngay_vao_lam: '',
    role:         'sales',
    trang_thai_nv: 'Đang làm',
    password:     '',
  })
  const supabase = createClient()

  const loadStaff = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setStaffList(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadStaff()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setMyRole(data?.role ?? ''))
    })
  }, [])

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let pass = ''
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setForm(f => ({ ...f, password: pass }))
  }

  const handleCreate = async () => {
    if (!form.full_name || !form.email || !form.password) {
      setErrorMsg('Vui lòng điền đầy đủ họ tên, email và mật khẩu')
      return
    }
    setSending(true)
    setErrorMsg('')
    setSuccessMsg('')

    const profileData = {
      email:         form.email,
      full_name:     form.full_name,
      role:          form.role,
      phone:         form.phone,
      department:    form.department,
      chuc_vu:       form.chuc_vu || null,
      khu_vuc:       form.khu_vuc || null,
      target_thang:  form.target_thang ? Number(form.target_thang.replace(/\D/g, '')) : null,
      ngay_vao_lam:  form.ngay_vao_lam || null,
      trang_thai_nv: form.trang_thai_nv,
      is_active:     form.trang_thai_nv !== 'Nghỉ việc',
    }

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
      user_metadata: { full_name: form.full_name, role: form.role },
    })

    if (error) {
      // Fallback: signUp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, role: form.role } },
      })
      if (signUpError) {
        setErrorMsg('Lỗi tạo tài khoản: ' + signUpError.message)
        setSending(false)
        return
      }
      if (signUpData.user) {
        await supabase.from('profiles').upsert({ id: signUpData.user.id, ...profileData })
      }
    } else if (created.user) {
      await supabase.from('profiles').upsert({ id: created.user.id, ...profileData })
    }

    // Gửi email qua N8n
    try {
      await fetch('/api/send-staff-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:  form.full_name,
          email:      form.email,
          password:   form.password,
          role:       form.role,
          department: form.department,
        }),
      })
    } catch (e) {
      console.error('N8n webhook error:', e)
    }

    setSending(false)
    setSuccessMsg(`Đã tạo tài khoản cho ${form.full_name}. Email đã được gửi.`)
    setForm({
      full_name: '', email: '', phone: '', department: '', chuc_vu: '',
      khu_vuc: '', target_thang: '', ngay_vao_lam: '',
      role: 'sales', trang_thai_nv: 'Đang làm', password: '',
    })
    setShowForm(false)
    loadStaff()
  }

  const startEdit = (staff: Staff) => {
    setEditId(staff.id)
    setEditForm({
      full_name:    staff.full_name,
      phone:        staff.phone,
      chuc_vu:      staff.chuc_vu,
      department:   staff.department,
      khu_vuc:      staff.khu_vuc,
      target_thang: staff.target_thang,
      ngay_vao_lam: staff.ngay_vao_lam,
      role:         staff.role,
    })
  }

  const handleResetPass = async (id: string) => {
    if (!resetPass || resetPass.length < 8) {
      setResetMsg('error:Mật khẩu phải có ít nhất 8 ký tự')
      return
    }
    setResetSaving(true)
    setResetMsg('')
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPass }),
      })
      const data = await res.json()
      if (!res.ok) { setResetMsg('error:' + (data.error || 'Lỗi')); return }
      setResetMsg('ok:Đã đặt lại mật khẩu thành công')
      setResetPass('')
      setTimeout(() => { setResetId(null); setResetMsg('') }, 2000)
    } catch {
      setResetMsg('error:Lỗi kết nối')
    } finally {
      setResetSaving(false)
    }
  }

  const saveEdit = async (id: string) => {
    setSaving(true)
    await supabase.from('profiles').update({
      full_name:    editForm.full_name,
      phone:        editForm.phone,
      chuc_vu:      editForm.chuc_vu || null,
      department:   editForm.department || null,
      khu_vuc:      editForm.khu_vuc || null,
      target_thang: editForm.target_thang || null,
      ngay_vao_lam: editForm.ngay_vao_lam || null,
      role:         editForm.role,
    }).eq('id', id)
    setSaving(false)
    setEditId(null)
    loadStaff()
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('profiles').update({
      trang_thai_nv: status,
      is_active:     status !== 'Nghỉ việc',
    }).eq('id', id)
    loadStaff()
  }

  const fmtMoney = (n: number | null) =>
    n ? n.toLocaleString('vi-VN') + ' đ' : '—'

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('vi-VN') : '—'

  // Active = not "Nghỉ việc"
  const activeCount = staffList.filter(s => s.trang_thai_nv !== 'Nghỉ việc').length

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Nhân viên</h1>
          <p className="text-xs text-gray-500">{activeCount}/{staffList.length} đang làm</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setSuccessMsg(''); setErrorMsg('') }}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2"
        >
          <span className="text-base leading-none">+</span> Thêm nhân viên
        </button>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Tạo tài khoản mới</h2>
          <div className="space-y-3">

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-600 mb-1 block">Họ và tên *</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nguyễn Văn A"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-600 mb-1 block">Email *</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="nhanvien@gmail.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Số điện thoại</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0901234567"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Ngày vào làm</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.ngay_vao_lam}
                  onChange={e => setForm(f => ({ ...f, ngay_vao_lam: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Chức vụ</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhân viên / Trưởng nhóm..."
                  value={form.chuc_vu}
                  onChange={e => setForm(f => ({ ...f, chuc_vu: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Phòng ban</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Kinh doanh / Kỹ thuật..."
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Khu vực</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={form.khu_vuc}
                  onChange={e => setForm(f => ({ ...f, khu_vuc: e.target.value }))}
                >
                  <option value="">— Chọn khu vực —</option>
                  {KHU_VUC_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Target tháng (VNĐ)</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="100,000,000"
                  value={form.target_thang}
                  onChange={e => setForm(f => ({ ...f, target_thang: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Vai trò *</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Trạng thái</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={form.trang_thai_nv}
                  onChange={e => setForm(f => ({ ...f, trang_thai_nv: e.target.value }))}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Mật khẩu *</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="Nhập hoặc tạo tự động"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button
                  onClick={generatePassword}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-2 rounded-xl whitespace-nowrap"
                >
                  Tạo tự động
                </button>
              </div>
              {form.password && (
                <p className="text-xs text-blue-600 mt-1 font-mono bg-blue-50 px-2 py-1 rounded-lg">
                  Pass: {form.password}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setShowForm(false); setErrorMsg('') }}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl"
            >
              Huỷ
            </button>
            <button
              onClick={handleCreate}
              disabled={sending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2.5 rounded-xl"
            >
              {sending ? 'Đang tạo...' : 'Tạo & Gửi email'}
            </button>
          </div>
        </div>
      )}

      {/* ── Staff list ── */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
          <span className="crm-spinner" /><span>Đang tải...</span>
        </div>
      ) : staffList.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2">
          <span className="text-4xl">👤</span>
          <p className="text-sm font-medium text-gray-500">Chưa có nhân viên nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staffList.map(staff => {
            const isExpanded = expandedId === staff.id
            const status = staff.trang_thai_nv || (staff.is_active ? 'Đang làm' : 'Nghỉ việc')
            return (
              <div key={staff.id} className="bg-white rounded-2xl shadow-sm border border-gray-100">
                {/* Card header — tap to expand */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : staff.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        status === 'Nghỉ việc' ? 'bg-gray-300' : 'bg-blue-600'
                      }`}>
                        <span className="text-white text-sm font-bold">
                          {staff.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{staff.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{staff.email}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLOR[staff.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABEL[staff.role] ?? staff.role}
                    </span>
                    {staff.chuc_vu && (
                      <span className="text-xs text-gray-500">{staff.chuc_vu}</span>
                    )}
                    {staff.khu_vuc && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{staff.khu_vuc}</span>
                    )}
                    <span className="text-xs text-gray-300 ml-auto">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    {editId === staff.id ? (
                      /* ── Edit mode ── */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { key: 'full_name',  label: 'Họ và tên',    type: 'text'  },
                            { key: 'phone',      label: 'SĐT',           type: 'tel'   },
                            { key: 'chuc_vu',    label: 'Chức vụ',       type: 'text'  },
                            { key: 'department', label: 'Phòng ban',      type: 'text'  },
                            { key: 'ngay_vao_lam', label: 'Ngày vào làm', type: 'date' },
                            { key: 'target_thang', label: 'Target (VNĐ)', type: 'number' },
                          ] as const).map(({ key, label, type }) => (
                            <div key={key} className={key === 'full_name' ? 'col-span-2' : ''}>
                              <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                              <input
                                type={type}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={String(editForm[key] ?? '')}
                                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                              />
                            </div>
                          ))}

                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">Khu vực</label>
                            <select
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editForm.khu_vuc ?? ''}
                              onChange={e => setEditForm(f => ({ ...f, khu_vuc: e.target.value }))}
                            >
                              <option value="">— Chọn —</option>
                              {KHU_VUC_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">Vai trò</label>
                            <select
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editForm.role ?? ''}
                              onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                            >
                              {ROLE_OPTIONS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setEditId(null)}
                            className="flex-1 border border-gray-200 text-gray-500 text-sm py-2 rounded-xl"
                          >
                            Huỷ
                          </button>
                          <button
                            onClick={() => saveEdit(staff.id)}
                            disabled={saving}
                            className="flex-1 bg-blue-600 disabled:bg-blue-400 text-white text-sm font-medium py-2 rounded-xl"
                          >
                            {saving ? 'Đang lưu...' : 'Lưu'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── View mode ── */
                      <>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          {staff.phone && (
                            <>
                              <span className="text-gray-400">SĐT</span>
                              <span className="text-gray-700 font-medium">{staff.phone}</span>
                            </>
                          )}
                          {staff.department && (
                            <>
                              <span className="text-gray-400">Phòng ban</span>
                              <span className="text-gray-700 font-medium">{staff.department}</span>
                            </>
                          )}
                          {staff.ngay_vao_lam && (
                            <>
                              <span className="text-gray-400">Ngày vào làm</span>
                              <span className="text-gray-700 font-medium">{fmtDate(staff.ngay_vao_lam)}</span>
                            </>
                          )}
                          {staff.target_thang != null && (
                            <>
                              <span className="text-gray-400">Target/tháng</span>
                              <span className="text-gray-700 font-medium">{fmtMoney(staff.target_thang)}</span>
                            </>
                          )}
                        </div>

                        {/* Trạng thái */}
                        <div>
                          <p className="text-xs text-gray-400 mb-1.5">Trạng thái</p>
                          <div className="flex flex-wrap gap-2">
                            {STATUS_OPTIONS.map(s => (
                              <button
                                key={s}
                                onClick={() => updateStatus(staff.id, s)}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                                  status === s
                                    ? STATUS_COLOR[s] + ' border-current'
                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Edit button */}
                        <button
                          onClick={() => startEdit(staff)}
                          className="w-full border border-gray-200 text-gray-500 text-sm py-2 rounded-xl hover:border-gray-300 transition-colors"
                        >
                          Chỉnh sửa thông tin
                        </button>

                        {/* Admin reset password */}
                        {['admin', 'ceo'].includes(myRole) && (
                          resetId === staff.id ? (
                            <div className="space-y-2 pt-1">
                              <p className="text-xs text-gray-400">Đặt mật khẩu mới</p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Tối thiểu 8 ký tự"
                                  value={resetPass}
                                  onChange={e => { setResetPass(e.target.value); setResetMsg('') }}
                                />
                                <button
                                  onClick={() => { setResetId(null); setResetPass(''); setResetMsg('') }}
                                  className="text-xs px-3 py-2 border border-gray-200 rounded-xl text-gray-400"
                                >
                                  Huỷ
                                </button>
                              </div>
                              {resetMsg && (
                                <p className={`text-xs px-3 py-1.5 rounded-lg ${resetMsg.startsWith('ok:') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                  {resetMsg.slice(3)}
                                </p>
                              )}
                              <button
                                onClick={() => handleResetPass(staff.id)}
                                disabled={resetSaving}
                                className="w-full bg-red-500 disabled:bg-red-300 text-white text-sm font-medium py-2 rounded-xl"
                              >
                                {resetSaving ? 'Đang lưu...' : 'Xác nhận đặt lại mật khẩu'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setResetId(staff.id); setResetPass(''); setResetMsg('') }}
                              className="w-full border border-red-200 text-red-500 text-sm py-2 rounded-xl hover:bg-red-50 transition-colors"
                            >
                              Đặt lại mật khẩu
                            </button>
                          )
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
