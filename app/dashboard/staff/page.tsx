'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Staff {
  id: string
  full_name: string
  email: string
  role: string
  phone: string
  department: string
  is_active: boolean
  created_at: string
}

const roleLabel: Record<string, string> = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  sales: 'Kinh doanh',
  tech: 'Kỹ thuật',
}

const roleColor: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  sales: 'bg-green-100 text-green-700',
  tech: 'bg-orange-100 text-orange-700',
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    role: 'sales',
    password: '',
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

  useEffect(() => { loadStaff() }, [])

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

    const { data, error } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
      user_metadata: { full_name: form.full_name, role: form.role }
    })

    if (error) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, role: form.role } }
      })

      if (signUpError) {
        setErrorMsg('Lỗi tạo tài khoản: ' + signUpError.message)
        setSending(false)
        return
      }

      if (signUpData.user) {
        await supabase.from('profiles').upsert({
          id: signUpData.user.id,
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          phone: form.phone,
          department: form.department,
        })
      }
    } else if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        phone: form.phone,
        department: form.department,
      })
    }

    // Gọi N8n gửi email
    try {
      await fetch('/api/send-staff-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          role: form.role,
          department: form.department,
        }),
      })
    } catch (e) {
      console.error('N8n webhook error:', e)
    }

    setSending(false)
    setSuccessMsg(`✅ Đã tạo tài khoản cho ${form.full_name}. Email đã được gửi.`)
    setForm({ full_name: '', email: '', phone: '', department: '', role: 'sales', password: '' })
    setShowForm(false)
    loadStaff()
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('profiles').update({ is_active: !current }).eq('id', id)
    loadStaff()
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Nhân viên</h1>
          <p className="text-xs text-gray-500">{staffList.length} tài khoản</p>
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

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Tạo tài khoản mới</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Họ và tên *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nguyễn Văn A"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div>
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
              <label className="text-sm font-medium text-gray-600 mb-1 block">Phòng ban</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Kinh doanh / Kỹ thuật /..."
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Vai trò *</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="sales">Kinh doanh</option>
                <option value="tech">Kỹ thuật</option>
                <option value="manager">Quản lý</option>
                <option value="admin">Quản trị viên</option>
              </select>
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
              {sending ? 'Đang tạo...' : '✉️ Tạo & Gửi email'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm"><span className="crm-spinner" /><span>Đang tải...</span></div>
      ) : staffList.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2">
          <span className="text-4xl">👤</span>
          <p className="text-sm font-medium text-gray-500">Chưa có nhân viên nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staffList.map(staff => (
            <div key={staff.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">
                      {staff.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{staff.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{staff.email}</p>
                    {staff.phone && (
                      <p className="text-xs text-gray-500">{staff.phone}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(staff.id, staff.is_active)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                    staff.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {staff.is_active ? 'Đang làm' : 'Nghỉ'}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleColor[staff.role] ?? 'bg-gray-100 text-gray-600'}`}>
                  {roleLabel[staff.role] ?? staff.role}
                </span>
                {staff.department && (
                  <span className="text-xs text-gray-500">{staff.department}</span>
                )}
                <span className="text-xs text-gray-300 ml-auto">
                  {new Date(staff.created_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}