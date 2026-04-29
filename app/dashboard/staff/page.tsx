'use client'

import { useEffect, useState, useMemo } from 'react'

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

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]))

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

const STATUS_OPTIONS = ['Đang làm', 'Thử việc', 'Tạm nghỉ', 'Nghỉ việc']
const STATUS_COLOR: Record<string, string> = {
  'Đang làm': 'bg-green-100 text-green-700',
  'Thử việc': 'bg-blue-100 text-blue-700',
  'Tạm nghỉ': 'bg-yellow-100 text-yellow-700',
  'Nghỉ việc': 'bg-red-100 text-red-600',
}

const KHU_VUC_OPTIONS = [
  { value: 'CN', label: 'Cả nước'   },
  { value: 'MN', label: 'Miền Nam'  },
  { value: 'MB', label: 'Miền Bắc'  },
  { value: 'MT', label: 'Miền Trung' },
]
const KHU_VUC_LABEL: Record<string, string> = Object.fromEntries(KHU_VUC_OPTIONS.map(k => [k.value, k.label]))
const HN_OPTIONS       = ['Độc thân', 'Đã kết hôn', 'Ly hôn']
const NH_OPTIONS       = ['Vietcombank','MB Bank','Techcombank','VietinBank','BIDV','VPBank','ACB','TPBank','Sacombank','HDBank','Khác']

// ─── Types ────────────────────────────────────────────────────────────────────

interface Staff {
  id: string
  full_name: string
  email: string
  role: string
  phone?: string
  chuc_vu?: string
  khu_vuc?: string
  trang_thai_nv: string
  // manager-only fields
  department?: string
  target_thang?: number | null
  ngay_vao_lam?: string | null
  is_active?: boolean
  created_at?: string
  ngay_sinh?: string | null
  dia_chi?: string | null
  cccd?: string | null
  so_tk_nh?: string | null
  ngan_hang?: string | null
  tinh_trang_hn?: string | null
  ghi_chu_nb?: string | null
}

interface NewUserForm {
  full_name: string; email: string; role: string; phone: string
  chuc_vu: string; khu_vuc: string; target_thang: string; ngay_vao_lam: string
  trang_thai_nv: string
}

const EMPTY_FORM: NewUserForm = {
  full_name: '', email: '', role: 'sales', phone: '',
  chuc_vu: '', khu_vuc: '', target_thang: '', ngay_vao_lam: '',
  trang_thai_nv: 'Đang làm',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [staffList,    setStaffList]    = useState<Staff[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState('')
  const [isManager,    setIsManager]    = useState(false)
  const [isAdmin,      setIsAdmin]      = useState(false)

  // Filters
  const [search,       setSearch]       = useState('')
  const [filterRole,   setFilterRole]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterKV,     setFilterKV]     = useState('')

  // Card state
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [editId,       setEditId]       = useState<string | null>(null)
  const [editForm,     setEditForm]     = useState<Partial<Staff>>({})
  const [saving,       setSaving]       = useState(false)
  const [saveMsg,      setSaveMsg]      = useState('')

  // Reset password
  const [resetId,      setResetId]      = useState<string | null>(null)
  const [resetPass,    setResetPass]    = useState('')
  const [resetSaving,  setResetSaving]  = useState(false)
  const [resetMsg,     setResetMsg]     = useState('')

  // Offboarding
  const [offboardId,   setOffboardId]   = useState<string | null>(null)
  const [offboarding,  setOffboarding]  = useState(false)
  const [offboardMsg,  setOffboardMsg]  = useState('')

  // KPI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kpiData,      setKpiData]      = useState<Record<string, any>>({})
  const [kpiLoading,   setKpiLoading]   = useState<Set<string>>(new Set())
  const [kpiMonth,     setKpiMonth]     = useState(new Date().getMonth() + 1)
  const [kpiYear,      setKpiYear]      = useState(new Date().getFullYear())
  const [kpiModal,     setKpiModal]     = useState<string | null>(null)
  const [kpiForm,      setKpiForm]      = useState({ target_revenue: '', target_contracts: '', target_customers: '' })
  const [kpiSaving,    setKpiSaving]    = useState(false)
  const [kpiSaveMsg,   setKpiSaveMsg]   = useState('')

  // Create new user
  const [showCreate,   setShowCreate]   = useState(false)
  const [createForm,   setCreateForm]   = useState<NewUserForm>(EMPTY_FORM)
  const [creating,     setCreating]     = useState(false)
  const [createMsg,    setCreateMsg]    = useState('')

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadStaff = async () => {
    setLoading(true)
    setLoadError('')
    const res = await fetch('/api/admin/users')
    const json = await res.json()
    if (res.ok) {
      setStaffList(json.data ?? [])
      setIsManager(json.isManager ?? false)
      setIsAdmin(json.isAdmin ?? false)
    } else {
      setLoadError(json.error ?? `Lỗi ${res.status}`)
    }
    setLoading(false)
  }

  useEffect(() => { loadStaff() }, [])

  // ─── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return staffList.filter(s => {
      if (q && !s.full_name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q) && !(s.phone ?? '').includes(q)) return false
      if (filterRole   && s.role !== filterRole)           return false
      if (filterStatus && s.trang_thai_nv !== filterStatus) return false
      if (filterKV     && s.khu_vuc !== filterKV)          return false
      return true
    })
  }, [staffList, search, filterRole, filterStatus, filterKV])

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:    staffList.length,
    active:   staffList.filter(s => s.trang_thai_nv === 'Đang làm').length,
    probation:staffList.filter(s => s.trang_thai_nv === 'Thử việc').length,
    leave:    staffList.filter(s => s.trang_thai_nv === 'Tạm nghỉ').length,
  }), [staffList])

  // ─── Save edit ─────────────────────────────────────────────────────────────

  const handleSave = async (id: string) => {
    setSaving(true); setSaveMsg('')
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm }),
    })
    const json = await res.json()
    if (res.ok) {
      setStaffList(list => list.map(s => s.id === id ? { ...s, ...editForm } : s))
      setEditId(null)
      setSaveMsg('Đã lưu.')
      setTimeout(() => setSaveMsg(''), 3000)
    } else {
      setSaveMsg(json.error ?? 'Lỗi khi lưu')
    }
    setSaving(false)
  }

  // ─── Reset password ────────────────────────────────────────────────────────

  const handleResetPass = async (id: string) => {
    if (!resetPass || resetPass.length < 8) { setResetMsg('Mật khẩu tối thiểu 8 ký tự'); return }
    setResetSaving(true); setResetMsg('')
    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPass }),
    })
    const json = await res.json()
    setResetMsg(res.ok ? 'Đã đặt lại mật khẩu thành công.' : (json.error ?? 'Lỗi'))
    if (res.ok) { setResetPass(''); setTimeout(() => { setResetId(null); setResetMsg('') }, 2000) }
    setResetSaving(false)
  }

  // ─── Offboard ──────────────────────────────────────────────────────────────

  const handleOffboard = async (id: string) => {
    setOffboarding(true); setOffboardMsg('')
    const res = await fetch(`/api/admin/users/${id}/offboard`, { method: 'POST' })
    const json = await res.json()
    if (res.ok) {
      setOffboardMsg(`Hoàn tất. Đã chuyển ${json.transferred} KH sang ${json.ceoName}.`)
      setStaffList(list => list.map(s => s.id === id
        ? { ...s, trang_thai_nv: 'Nghỉ việc', is_active: false }
        : s
      ))
      setTimeout(() => { setOffboardId(null); setOffboardMsg('') }, 3000)
    } else {
      setOffboardMsg(json.error ?? 'Lỗi khi offboard')
    }
    setOffboarding(false)
  }

  // ─── Create user ───────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setCreating(true); setCreateMsg('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createForm,
        target_thang: createForm.target_thang ? Number(createForm.target_thang) : null,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setCreateMsg('Tạo thành công! Email mời đã được gửi.')
      setCreateForm(EMPTY_FORM)
      await loadStaff()
      setTimeout(() => { setShowCreate(false); setCreateMsg('') }, 2500)
    } else {
      setCreateMsg(json.error ?? 'Lỗi khi tạo tài khoản')
    }
    setCreating(false)
  }

  // ─── KPI ───────────────────────────────────────────────────────────────────

  const loadKpi = (userId: string) => {
    setKpiLoading(prev => new Set(prev).add(userId))
    fetch(`/api/kpi/me?userId=${userId}&month=${kpiMonth}&year=${kpiYear}`)
      .then(r => r.json())
      .then(d => setKpiData(prev => ({ ...prev, [userId]: d })))
      .catch(() => setKpiData(prev => ({ ...prev, [userId]: null })))
      .finally(() => setKpiLoading(prev => { const s = new Set(prev); s.delete(userId); return s }))
  }

  const saveKpiTarget = async () => {
    if (!kpiModal) return
    setKpiSaving(true); setKpiSaveMsg('')
    try {
      const res = await fetch('/api/admin/kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:          kpiModal,
          month:            kpiMonth,
          year:             kpiYear,
          target_revenue:   kpiForm.target_revenue   ? Number(kpiForm.target_revenue.replace(/[^\d]/g, ''))   : 0,
          target_contracts: kpiForm.target_contracts ? Number(kpiForm.target_contracts) : 0,
          target_customers: kpiForm.target_customers ? Number(kpiForm.target_customers) : 0,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setKpiSaveMsg('Đã lưu mục tiêu')
        loadKpi(kpiModal)
        setTimeout(() => { setKpiModal(null); setKpiSaveMsg('') }, 1500)
      } else {
        setKpiSaveMsg(json.error ?? 'Lỗi lưu')
      }
    } catch { setKpiSaveMsg('Lỗi kết nối') }
    finally { setKpiSaving(false) }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="pb-32">

      {/* Header + Stats */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Nhân viên</h1>
            <p className="text-xs text-gray-500 mt-0.5">{filtered.length}/{staffList.length} nhân viên</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowCreate(true)}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl">
              + Thêm
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Tổng',     value: stats.total,     color: 'bg-gray-100 text-gray-700' },
            { label: 'Đang làm', value: stats.active,    color: 'bg-green-100 text-green-700' },
            { label: 'Thử việc', value: stats.probation, color: 'bg-blue-100 text-blue-700' },
            { label: 'Tạm nghỉ', value: stats.leave,     color: 'bg-yellow-100 text-yellow-700' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl px-2 py-2 text-center`}>
              <p className="text-lg font-bold leading-none">{s.value}</p>
              <p className="text-[10px] mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tên, email, SĐT..."
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {[
              { value: filterRole, set: setFilterRole, options: ROLE_OPTIONS.map(r => ({ value: r.value, label: r.label })), placeholder: 'Vai trò' },
              { value: filterStatus, set: setFilterStatus, options: STATUS_OPTIONS.map(s => ({ value: s, label: s })), placeholder: 'Trạng thái' },
              { value: filterKV, set: setFilterKV, options: KHU_VUC_OPTIONS, placeholder: 'Khu vực' },
            ].map((f, i) => (
              <select key={i} value={f.value} onChange={e => f.set(e.target.value)}
                className="shrink-0 px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{f.placeholder}</option>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ))}
            {(search || filterRole || filterStatus || filterKV) && (
              <button onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus(''); setFilterKV('') }}
                className="shrink-0 text-xs text-gray-500 px-3 py-2 border border-gray-200 rounded-xl">
                Xóa lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {saveMsg && (
        <div className="mx-4 mb-2 text-sm text-center py-2 px-4 rounded-xl bg-green-50 text-green-700">{saveMsg}</div>
      )}

      {/* Staff list */}
      <div className="px-4 space-y-3">
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            Lỗi tải dữ liệu: {loadError}
          </div>
        )}
        {!loadError && filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">Không tìm thấy nhân viên nào</p>
        )}

        {filtered.map(s => {
          const isExpanded = expandedId === s.id
          const isEditing  = editId === s.id
          const isResetting = resetId === s.id
          const isOffboarding = offboardId === s.id
          const initials = s.full_name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()

          return (
            <div key={s.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">

              {/* Collapsed row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => {
                  const willExpand = !isExpanded
                  setExpandedId(willExpand ? s.id : null)
                  setEditId(null); setResetId(null); setOffboardId(null)
                  if (willExpand && isManager && !kpiData[s.id]) loadKpi(s.id)
                }}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-blue-700">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[s.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABEL[s.role] ?? s.role}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[s.trang_thai_nv] ?? 'bg-gray-100'}`}>
                    {s.trang_thai_nv}
                  </span>
                </div>
                <span className={`text-gray-400 text-xs ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {/* Expanded */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">

                  {/* Basic info (all roles see) */}
                  <InfoGrid items={[
                    { label: 'SĐT',       value: s.phone },
                    { label: 'Chức vụ',   value: s.chuc_vu },
                    { label: 'Khu vực',   value: s.khu_vuc ? (KHU_VUC_LABEL[s.khu_vuc] ?? s.khu_vuc) : null },
                  ]} />

                  {/* Manager-only info */}
                  {isManager && !isEditing && (
                    <>
                      <InfoGrid items={[
                        { label: 'Ngày vào làm', value: s.ngay_vao_lam },
                        { label: 'Ngày sinh',    value: s.ngay_sinh },
                        { label: 'Địa chỉ',      value: s.dia_chi },
                        { label: 'Tình trạng HN',value: s.tinh_trang_hn },
                      ]} />
                      <InfoGrid items={[
                        { label: 'CMND/CCCD',   value: s.cccd },
                        { label: 'Ngân hàng',   value: s.ngan_hang },
                        { label: 'Số tài khoản',value: s.so_tk_nh },
                        { label: 'Target/tháng',value: s.target_thang ? s.target_thang.toLocaleString('vi-VN') + ' ₫' : null },
                      ]} />
                      {s.ghi_chu_nb && (
                        <div className="bg-amber-50 rounded-xl px-3 py-2">
                          <p className="text-xs text-amber-600 font-medium mb-1">Ghi chú nội bộ</p>
                          <p className="text-sm text-gray-700">{s.ghi_chu_nb}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Edit form */}
                  {isEditing && (
                    <EditForm
                      form={editForm}
                      setForm={setEditForm}
                      isAdmin={isAdmin}
                      onSave={() => handleSave(s.id)}
                      onCancel={() => setEditId(null)}
                      saving={saving}
                    />
                  )}

                  {/* Reset password UI */}
                  {isResetting && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-medium text-gray-600">Đặt lại mật khẩu</p>
                      <input
                        type="password"
                        value={resetPass}
                        onChange={e => setResetPass(e.target.value)}
                        placeholder="Mật khẩu mới (≥ 8 ký tự)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {resetMsg && <p className={`text-xs ${resetMsg.includes('thành công') ? 'text-green-600' : 'text-red-500'}`}>{resetMsg}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => { setResetId(null); setResetPass(''); setResetMsg('') }}
                          className="flex-1 py-2 rounded-xl border border-gray-300 text-sm text-gray-600">Hủy</button>
                        <button onClick={() => handleResetPass(s.id)} disabled={resetSaving}
                          className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                          {resetSaving ? 'Đang lưu...' : 'Xác nhận'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Offboard confirm */}
                  {isOffboarding && (
                    <div className="bg-red-50 rounded-xl px-3 py-3 space-y-2">
                      <p className="text-sm font-semibold text-red-700">Xác nhận cho nghỉ việc?</p>
                      <p className="text-xs text-red-600">
                        Toàn bộ khách hàng của <strong>{s.full_name}</strong> sẽ được chuyển sang CEO để phân bổ lại.
                        Tài khoản sẽ bị vô hiệu hóa ngay lập tức.
                      </p>
                      {offboardMsg && <p className={`text-xs font-medium ${offboardMsg.includes('Hoàn tất') ? 'text-green-700' : 'text-red-600'}`}>{offboardMsg}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => { setOffboardId(null); setOffboardMsg('') }}
                          className="flex-1 py-2 rounded-xl border border-gray-300 text-sm text-gray-600">Hủy</button>
                        <button onClick={() => handleOffboard(s.id)} disabled={offboarding}
                          className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-50">
                          {offboarding ? 'Đang xử lý...' : 'Xác nhận'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* KPI Card */}
                  {isManager && !isEditing && !isResetting && !isOffboarding && (
                    <KpiCard
                      data={kpiData[s.id]}
                      loading={kpiLoading.has(s.id)}
                      isAdmin={isAdmin}
                      month={kpiMonth}
                      year={kpiYear}
                      onSetTarget={() => {
                        const d = kpiData[s.id]
                        setKpiForm({
                          target_revenue:   d?.target?.target_revenue   ? String(d.target.target_revenue)   : '',
                          target_contracts: d?.target?.target_contracts ? String(d.target.target_contracts) : '',
                          target_customers: d?.target?.target_customers ? String(d.target.target_customers) : '',
                        })
                        setKpiModal(s.id)
                      }}
                    />
                  )}

                  {/* Action buttons (manager only, not while in sub-forms) */}
                  {isManager && !isEditing && !isResetting && !isOffboarding && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => { setEditId(s.id); setEditForm({ ...s }) }}
                        className="flex-1 py-2 rounded-xl border border-gray-300 text-sm text-gray-700 font-medium"
                      >
                        Sửa thông tin
                      </button>
                      <button
                        onClick={() => setResetId(s.id)}
                        className="flex-1 py-2 rounded-xl border border-blue-200 text-sm text-blue-600 font-medium"
                      >
                        Đặt lại mật khẩu
                      </button>
                      {s.trang_thai_nv !== 'Nghỉ việc' && (
                        <button
                          onClick={() => setOffboardId(s.id)}
                          className="w-full py-2 rounded-xl border border-red-200 text-sm text-red-600 font-medium"
                        >
                          Cho nghỉ việc
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* KPI target modal */}
      {kpiModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex flex-col justify-end"
          onClick={e => e.target === e.currentTarget && setKpiModal(null)}>
          <div className="bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-800">Đặt mục tiêu KPI</h2>
                <p className="text-xs text-gray-500">Tháng {kpiMonth}/{kpiYear}</p>
              </div>
              {/* Month/year selector */}
              <div className="flex gap-1.5 items-center">
                <select value={kpiMonth} onChange={e => setKpiMonth(Number(e.target.value))}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none">
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i+1} value={i+1}>T{i+1}</option>
                  ))}
                </select>
                <select value={kpiYear} onChange={e => setKpiYear(Number(e.target.value))}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none">
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={() => setKpiModal(null)} className="text-gray-400 p-1 text-lg ml-1">✕</button>
              </div>
            </div>
            <div className="p-5 space-y-4 pb-8">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Doanh thu mục tiêu (VNĐ)</label>
                <input type="text" inputMode="numeric" value={kpiForm.target_revenue}
                  onChange={e => setKpiForm(f => ({ ...f, target_revenue: e.target.value }))}
                  placeholder="Ví dụ: 100000000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Số hợp đồng mục tiêu</label>
                <input type="number" inputMode="numeric" min="0" value={kpiForm.target_contracts}
                  onChange={e => setKpiForm(f => ({ ...f, target_contracts: e.target.value }))}
                  placeholder="Ví dụ: 5"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Số khách hàng mới mục tiêu</label>
                <input type="number" inputMode="numeric" min="0" value={kpiForm.target_customers}
                  onChange={e => setKpiForm(f => ({ ...f, target_customers: e.target.value }))}
                  placeholder="Ví dụ: 10"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              {kpiSaveMsg && (
                <p className={`text-sm text-center py-2 rounded-xl ${kpiSaveMsg.includes('Đã lưu') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {kpiSaveMsg}
                </p>
              )}
              <button onClick={saveKpiTarget} disabled={kpiSaving}
                className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-2xl active:bg-blue-700 disabled:opacity-50">
                {kpiSaving ? 'Đang lưu...' : 'Lưu mục tiêu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center px-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-gray-800">Thêm nhân viên mới</h2>
              <button onClick={() => { setShowCreate(false); setCreateMsg('') }} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-500 bg-blue-50 rounded-xl px-3 py-2">
                Hệ thống sẽ gửi email mời để nhân viên tự đặt mật khẩu.
              </p>

              <FormField label="Họ tên *" value={createForm.full_name}
                onChange={v => setCreateForm(f => ({ ...f, full_name: v }))} placeholder="Nguyễn Văn A" />
              <FormField label="Email *" type="email" value={createForm.email}
                onChange={v => setCreateForm(f => ({ ...f, email: v }))} placeholder="example@gmail.com" />

              <div>
                <label className="block text-xs text-gray-500 mb-1">Vai trò *</label>
                <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <FormField label="Số điện thoại" value={createForm.phone}
                onChange={v => setCreateForm(f => ({ ...f, phone: v }))} placeholder="0901 234 567" />
              <FormField label="Chức vụ" value={createForm.chuc_vu}
                onChange={v => setCreateForm(f => ({ ...f, chuc_vu: v }))} placeholder="Nhân viên kinh doanh" />

              <div>
                <label className="block text-xs text-gray-500 mb-1">Khu vực</label>
                <select value={createForm.khu_vuc} onChange={e => setCreateForm(f => ({ ...f, khu_vuc: e.target.value }))}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Chọn khu vực --</option>
                  {KHU_VUC_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>

              <FormField label="Target tháng (VNĐ)" value={createForm.target_thang} type="number"
                onChange={v => setCreateForm(f => ({ ...f, target_thang: v }))} placeholder="50000000" />
              <FormField label="Ngày vào làm" value={createForm.ngay_vao_lam} type="date"
                onChange={v => setCreateForm(f => ({ ...f, ngay_vao_lam: v }))} />

              <div>
                <label className="block text-xs text-gray-500 mb-1">Trạng thái</label>
                <select value={createForm.trang_thai_nv} onChange={e => setCreateForm(f => ({ ...f, trang_thai_nv: e.target.value }))}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {createMsg && (
                <p className={`text-sm text-center py-2 px-3 rounded-xl ${createMsg.includes('thành công') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {createMsg}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowCreate(false); setCreateMsg('') }}
                  className="flex-1 py-3 rounded-xl border border-gray-300 text-sm text-gray-600">Hủy</button>
                <button onClick={handleCreate} disabled={creating || !createForm.full_name || !createForm.email}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                  {creating ? 'Đang tạo...' : 'Tạo & Gửi email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ data, loading, isAdmin, month, year, onSetTarget }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  loading: boolean
  isAdmin: boolean
  month: number
  year: number
  onSetTarget: () => void
}) {
  if (loading) {
    return (
      <div className="bg-gray-50 rounded-xl px-3 py-3 flex justify-center">
        <span className="crm-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
      </div>
    )
  }

  const target = data?.target
  const actual = data?.actual
  const perf   = data?.performance

  const fmtM    = (n: number | null | undefined) =>
    n != null ? (n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n.toLocaleString('vi-VN')) : '—'
  const pctBar  = (pct: number | null) => Math.min(100, Math.max(0, pct ?? 0))
  const barColor = (pct: number | null) => (pct ?? 0) >= 100 ? 'bg-green-500' : 'bg-blue-500'

  return (
    <div className="bg-gray-50 rounded-xl px-3 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">KPI {month}/{year}</p>
        {isAdmin && (
          <button
            onClick={onSetTarget}
            className="text-[10px] text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg font-semibold active:bg-blue-100"
          >
            ⚙ Đặt mục tiêu
          </button>
        )}
      </div>

      {!target ? (
        <p className="text-xs text-gray-400 text-center py-1">Chưa đặt mục tiêu tháng này</p>
      ) : (
        <>
          {/* Doanh thu */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] text-gray-500">Doanh thu</span>
              <span className="text-[11px] font-semibold text-gray-700">
                {fmtM(actual?.revenue)} / {fmtM(target.target_revenue)}
                {perf?.revenue != null && (
                  <span className={`ml-1.5 ${(perf.revenue ?? 0) >= 100 ? 'text-green-600' : 'text-blue-600'}`}>
                    {perf.revenue}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor(perf?.revenue)}`}
                style={{ width: `${pctBar(perf?.revenue)}%` }} />
            </div>
          </div>

          {/* Hợp đồng */}
          {target.target_contracts > 0 && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-gray-500">Hợp đồng</span>
                <span className="text-[11px] font-semibold text-gray-700">
                  {actual?.contracts ?? '—'} / {target.target_contracts} HĐ
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full transition-all"
                  style={{ width: `${pctBar(perf?.contracts)}%` }} />
              </div>
            </div>
          )}

          {/* KH mới */}
          {target.target_customers > 0 && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-gray-500">KH mới</span>
                <span className="text-[11px] font-semibold text-gray-700">
                  {actual?.customers ?? '—'} / {target.target_customers} KH
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400 rounded-full transition-all"
                  style={{ width: `${pctBar(perf?.customers)}%` }} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function InfoGrid({ items }: { items: { label: string; value?: string | number | null }[] }) {
  const visible = items.filter(i => i.value)
  if (visible.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {visible.map(item => (
        <div key={item.label}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
          <p className="text-sm text-gray-800 mt-0.5">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

function EditForm({ form, setForm, isAdmin, onSave, onCancel, saving }: {
  form: Partial<Staff>
  setForm: (f: Partial<Staff>) => void
  isAdmin: boolean
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const set = (k: keyof Staff) => (v: string) => setForm({ ...form, [k]: v || null })
  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chỉnh sửa thông tin</p>

      <div className="grid grid-cols-2 gap-2">
        <FormField label="Họ tên" value={form.full_name ?? ''} onChange={set('full_name')} />
        <FormField label="SĐT" value={form.phone ?? ''} onChange={set('phone')} />
        <FormField label="Chức vụ" value={form.chuc_vu ?? ''} onChange={set('chuc_vu')} />
        <div>
          <label className="block text-xs text-gray-500 mb-1">Khu vực</label>
          <select value={form.khu_vuc ?? ''} onChange={e => set('khu_vuc')(e.target.value)}
            className="w-full px-2 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none">
            <option value="">--</option>
            {KHU_VUC_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
      </div>

      {isAdmin && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Vai trò</label>
          <select value={form.role ?? ''} onChange={e => set('role')(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none">
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Trạng thái</label>
          <select value={form.trang_thai_nv ?? ''} onChange={e => set('trang_thai_nv')(e.target.value)}
            className="w-full px-2 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tình trạng HN</label>
          <select value={form.tinh_trang_hn ?? ''} onChange={e => set('tinh_trang_hn')(e.target.value)}
            className="w-full px-2 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none">
            <option value="">--</option>
            {HN_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FormField label="Ngày sinh" value={form.ngay_sinh ?? ''} type="date" onChange={set('ngay_sinh')} />
        <FormField label="Ngày vào làm" value={form.ngay_vao_lam ?? ''} type="date" onChange={set('ngay_vao_lam')} />
        <FormField label="Target/tháng (VNĐ)" value={form.target_thang ? String(form.target_thang) : ''}
          type="number" onChange={v => setForm({ ...form, target_thang: v ? Number(v) : null })} />
        <FormField label="CMND/CCCD" value={form.cccd ?? ''} onChange={set('cccd')} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ngân hàng</label>
          <select value={form.ngan_hang ?? ''} onChange={e => set('ngan_hang')(e.target.value)}
            className="w-full px-2 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none">
            <option value="">--</option>
            {NH_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <FormField label="Số tài khoản" value={form.so_tk_nh ?? ''} onChange={set('so_tk_nh')} />
      </div>

      <FormField label="Địa chỉ" value={form.dia_chi ?? ''} onChange={set('dia_chi')} placeholder="Số nhà, đường, quận, tỉnh" />

      <div>
        <label className="block text-xs text-gray-500 mb-1">Ghi chú nội bộ</label>
        <textarea value={form.ghi_chu_nb ?? ''} onChange={e => setForm({ ...form, ghi_chu_nb: e.target.value || null })}
          rows={2} placeholder="Chỉ admin và CEO thấy..."
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none resize-none" />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600">Hủy</button>
        <button onClick={onSave} disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}
