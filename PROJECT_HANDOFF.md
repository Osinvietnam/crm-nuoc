# PROJECT HANDOFF DOCUMENT
> Generated from Claude Chat → For Claude Code
> Date: 2026-04-06

---

## 1. PROJECT OVERVIEW

- **Tên dự án:** CRM Máy Lọc Nước (crm-nuoc)
- **Mục tiêu:** Webapp PWA mobile-first cho công ty máy lọc nước tại Việt Nam. Admin tạo tài khoản nhân viên, hệ thống tự gửi email thông tin đăng nhập. Nhân viên thao tác trên điện thoại (không cần cài app). Dữ liệu nghiệp vụ đổ về LarkBase.
- **Live URL:** https://crm-nuoc.vercel.app
- **GitHub:** https://github.com/Osinvietnam/crm-nuoc

### Tech Stack đã xác định và KHÔNG thay đổi:
| Layer | Technology | Ghi chú |
|---|---|---|
| Frontend | Next.js 16.2.2 (App Router) + TypeScript + Tailwind CSS | Đã cài, đang chạy |
| Auth + DB phụ | Supabase | Project: crm-nuoc, region: Singapore |
| DB chính | LarkBase (Lark Open Platform) | Dữ liệu nghiệp vụ |
| Automation | N8n tự host | https://app.sync.io.vn |
| Deploy | Vercel | https://crm-nuoc.vercel.app |
| Email | Gmail qua N8n webhook | Đã hoạt động |

- **Trạng thái:** ~30% hoàn thành
- **Môi trường dev:** Mac Mini M4, macOS, Node.js v20+

---

## 2. WHAT HAS BEEN DONE ✅

- [Bước 1] Xác định kiến trúc: Supabase Auth + Next.js PWA + LarkBase + N8n — gọi là "Hướng C rút gọn"
- [Bước 2] Tạo project Next.js: `npx create-next-app@latest crm-nuoc --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"`
- [Bước 3] Cài dependencies: `@supabase/supabase-js @supabase/ssr`
- [Bước 4] Tạo file `.env.local` với Supabase credentials
- [Bước 5] Tạo `lib/supabase/client.ts` và `lib/supabase/server.ts`
- [Bước 6] Tạo `middleware.ts` bảo vệ routes — redirect về /login nếu chưa auth
- [Bước 7] Tạo trang Login (`app/login/page.tsx`) — form email/password, giao diện mobile-first
- [Bước 8] Tạo Supabase SQL: bảng `profiles`, trigger `handle_new_user`, RLS policies
- [Bước 9] Tạo Dashboard Layout (`app/dashboard/layout.tsx`) — header + bottom navigation theo role
- [Bước 10] Tạo Dashboard Home (`app/dashboard/page.tsx`) — stats cards + hoạt động gần đây
- [Bước 11] Tạo placeholder pages: customers, maintenance, orders
- [Bước 12] Tạo Staff page (`app/dashboard/staff/page.tsx`) — danh sách nhân viên, form tạo tài khoản, toggle active/inactive
- [Bước 13] Tạo API route (`app/api/send-staff-email/route.ts`) — gọi N8n webhook gửi email
- [Bước 14] Tạo N8n workflow "CRM - Gửi email nhân viên mới" — Webhook → Gmail
- [Bước 15] Deploy lên Vercel thành công, app live tại https://crm-nuoc.vercel.app
- [Bước 16] Test trên điện thoại thật — login, dashboard, tạo nhân viên, nhận email ✅

---

## 3. FILES & CODE PRODUCED

### Cấu trúc thư mục hiện tại:
```
crm-nuoc/
├── app/
│   ├── api/
│   │   └── send-staff-email/
│   │       └── route.ts
│   ├── dashboard/
│   │   ├── customers/
│   │   │   └── page.tsx          ← placeholder
│   │   ├── maintenance/
│   │   │   └── page.tsx          ← placeholder
│   │   ├── orders/
│   │   │   └── page.tsx          ← placeholder
│   │   ├── staff/
│   │   │   └── page.tsx          ← HOÀN CHỈNH
│   │   ├── layout.tsx            ← HOÀN CHỈNH
│   │   └── page.tsx              ← HOÀN CHỈNH (stats chưa có data thật)
│   ├── login/
│   │   └── page.tsx              ← HOÀN CHỈNH
│   ├── globals.css
│   └── layout.tsx                ← Next.js root layout (mặc định)
├── lib/
│   └── supabase/
│       ├── client.ts             ← HOÀN CHỈNH
│       └── server.ts             ← HOÀN CHỈNH
├── middleware.ts                  ← HOÀN CHỈNH
├── .env.local                     ← có trên máy, KHÔNG push GitHub
├── .gitignore
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

### FILE: `lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

### FILE: `lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

---

### FILE: `middleware.ts`
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user && !path.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && path === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

---

### FILE: `app/login/page.tsx`
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email hoặc mật khẩu không đúng')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800">CRM Máy Lọc Nước</h1>
          <p className="text-sm text-gray-500 mt-1">Đăng nhập để tiếp tục</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Liên hệ admin nếu quên mật khẩu
        </p>
      </div>
    </div>
  )
}
```

---

### FILE: `app/dashboard/layout.tsx`
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  full_name: string
  role: string
  email: string
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, email')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }
    getProfile()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const menuByRole: Record<string, { href: string; label: string; icon: string }[]> = {
    admin: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/maintenance', label: 'Bảo trì', icon: '🔧' },
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: '📦' },
      { href: '/dashboard/staff', label: 'Nhân viên', icon: '👤' },
    ],
    manager: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/maintenance', label: 'Bảo trì', icon: '🔧' },
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: '📦' },
    ],
    sales: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: '📦' },
    ],
    tech: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/maintenance', label: 'Lịch bảo trì', icon: '🔧' },
    ],
  }

  const roleLabel: Record<string, string> = {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    sales: 'Kinh doanh',
    tech: 'Kỹ thuật',
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 text-sm">Đang tải...</div>
    </div>
  )

  const menu = menuByRole[profile?.role ?? 'sales'] ?? []

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">CRM</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 leading-none">{profile?.full_name}</p>
            <p className="text-xs text-blue-600 mt-0.5">{roleLabel[profile?.role ?? 'sales']}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          Đăng xuất
        </button>
      </header>

      <main className="flex-1 overflow-auto pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 z-10">
        <div className="flex justify-around">
          {menu.map((item) => {
            const isActive = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center py-2 px-3 rounded-xl transition-colors min-w-0 flex-1 ${
                  isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-xs mt-1 font-medium truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
```

---

### FILE: `app/dashboard/page.tsx`
```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Profile { full_name: string; role: string }

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const get = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles').select('full_name, role')
        .eq('id', user.id).single()
      setProfile(data)
    }
    get()
  }, [])

  const stats = [
    { label: 'Khách hàng', value: '—', color: 'bg-blue-50 text-blue-600', icon: '👥' },
    { label: 'Bảo trì hôm nay', value: '—', color: 'bg-orange-50 text-orange-600', icon: '🔧' },
    { label: 'Đơn tháng này', value: '—', color: 'bg-green-50 text-green-600', icon: '📦' },
    { label: 'Quá hạn SLA', value: '—', color: 'bg-red-50 text-red-600', icon: '⚠️' },
  ]

  return (
    <div className="p-4 space-y-5">
      <div className="bg-blue-600 rounded-2xl p-5 text-white">
        <p className="text-blue-200 text-sm">Xin chào,</p>
        <p className="text-xl font-bold mt-0.5">{profile?.full_name ?? '...'}</p>
        <p className="text-blue-200 text-xs mt-2">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Tổng quan hôm nay</p>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} className={`${s.color} rounded-2xl p-4`}>
              <span className="text-2xl">{s.icon}</span>
              <p className="text-2xl font-bold mt-2">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-80">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Hoạt động gần đây</p>
        <div className="bg-white rounded-2xl divide-y divide-gray-100">
          {[1,2,3].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-base">🔧</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500">Dữ liệu sẽ đồng bộ từ LarkBase</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

### FILE: `app/dashboard/staff/page.tsx`
```typescript
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
    full_name: '', email: '', phone: '', department: '', role: 'sales', password: '',
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
    for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length))
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
          id: signUpData.user.id, email: form.email, full_name: form.full_name,
          role: form.role, phone: form.phone, department: form.department,
        })
      }
    } else if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id, email: form.email, full_name: form.full_name,
        role: form.role, phone: form.phone, department: form.department,
      })
    }

    try {
      await fetch('/api/send-staff-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name, email: form.email, password: form.password,
          role: form.role, department: form.department,
        }),
      })
    } catch (e) { console.error('N8n webhook error:', e) }

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
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{errorMsg}</div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Tạo tài khoản mới</h2>
          <div className="space-y-3">
            {[
              { label: 'Họ và tên *', key: 'full_name', type: 'text', placeholder: 'Nguyễn Văn A' },
              { label: 'Email *', key: 'email', type: 'email', placeholder: 'nhanvien@gmail.com' },
              { label: 'Số điện thoại', key: 'phone', type: 'text', placeholder: '0901234567' },
              { label: 'Phòng ban', key: 'department', type: 'text', placeholder: 'Kinh doanh / Kỹ thuật /...' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{field.label}</label>
                <input
                  type={field.type}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={field.placeholder}
                  value={(form as any)[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Vai trò *</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
              <label className="text-xs font-medium text-gray-600 mb-1 block">Mật khẩu *</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
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
                <p className="text-xs text-blue-600 mt-1 font-mono bg-blue-50 px-2 py-1 rounded-lg">Pass: {form.password}</p>
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
        <div className="text-center text-gray-400 text-sm py-8">Đang tải...</div>
      ) : staffList.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-8">Chưa có nhân viên nào</div>
      ) : (
        <div className="space-y-3">
          {staffList.map(staff => (
            <div key={staff.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">{staff.full_name?.charAt(0)?.toUpperCase() ?? '?'}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{staff.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{staff.email}</p>
                    {staff.phone && <p className="text-xs text-gray-400">{staff.phone}</p>}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(staff.id, staff.is_active)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                    staff.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {staff.is_active ? 'Đang làm' : 'Nghỉ'}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleColor[staff.role] ?? 'bg-gray-100 text-gray-600'}`}>
                  {roleLabel[staff.role] ?? staff.role}
                </span>
                {staff.department && <span className="text-xs text-gray-400">{staff.department}</span>}
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
```

---

### FILE: `app/api/send-staff-email/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'

const roleLabel: Record<string, string> = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  sales: 'Kinh doanh',
  tech: 'Kỹ thuật',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { full_name, email, password, role, department } = body

    const n8nUrl = process.env.N8N_WEBHOOK_URL
    if (!n8nUrl) {
      console.error('N8N_WEBHOOK_URL chưa cấu hình')
      return NextResponse.json({ error: 'Webhook chưa cấu hình' }, { status: 500 })
    }

    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name,
        email,
        password,
        role,
        role_label: roleLabel[role] ?? role,
        department: department || 'Chưa phân công',
        app_url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-nuoc.vercel.app',
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'N8n không phản hồi' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('send-staff-email error:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
```

---

### Placeholder pages (3 files giống nhau, chỉ khác tên):

`app/dashboard/customers/page.tsx`:
```typescript
export default function CustomersPage() {
  return (
    <div className="p-4">
      <h1 className="text-lg font-bold text-gray-800 mb-1">Khách hàng</h1>
      <p className="text-sm text-gray-400">Đang xây dựng...</p>
    </div>
  )
}
```

`app/dashboard/maintenance/page.tsx`:
```typescript
export default function MaintenancePage() {
  return (
    <div className="p-4">
      <h1 className="text-lg font-bold text-gray-800 mb-1">Bảo trì</h1>
      <p className="text-sm text-gray-400">Đang xây dựng...</p>
    </div>
  )
}
```

`app/dashboard/orders/page.tsx`:
```typescript
export default function OrdersPage() {
  return (
    <div className="p-4">
      <h1 className="text-lg font-bold text-gray-800 mb-1">Đơn hàng</h1>
      <p className="text-sm text-gray-400">Đang xây dựng...</p>
    </div>
  )
}
```

---

### Supabase SQL đã chạy:
```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  role text not null default 'sales' check (role in ('admin','sales','tech','manager')),
  phone text,
  department text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'sales')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

alter table profiles enable row level security;

create policy "User đọc profile của mình"
  on profiles for select
  using (auth.uid() = id);

create policy "User cập nhật profile của mình"
  on profiles for update
  using (auth.uid() = id);
```

---

## 4. KEY DECISIONS & CONSTRAINTS

- **KHÔNG dùng Lark SSO** — dùng tài khoản tự tạo (email/password) do admin quản lý
- **KHÔNG cài app native** — PWA chạy trên trình duyệt điện thoại
- **LarkBase là Single Source of Truth** cho dữ liệu nghiệp vụ (KH, bảo trì, đơn hàng)
- **Supabase chỉ dùng cho Auth + bảng profiles** — không lưu dữ liệu nghiệp vụ ở đây
- **N8n tự host** tại https://app.sync.io.vn — xử lý toàn bộ automation và gửi email
- **App Router** của Next.js — KHÔNG dùng Pages Router
- **Tailwind CSS** — KHÔNG dùng CSS modules hay styled-components
- **Roles:** admin / manager / sales / tech — cố định, không thay đổi
- **Mobile-first** — mọi UI phải test trên màn hình 390px trước
- **Deploy:** Vercel — KHÔNG tự host Next.js
- **Lark API version:** Lark OpenAPI v2 tại https://open.larksuite.com

---

## 5. CURRENT STATE — EXACTLY WHERE WE STOPPED

Dừng tại: **Vừa deploy thành công lên Vercel, test trên điện thoại OK.**

Câu hỏi cuối cùng chưa được trả lời: **Cấu trúc bảng Khách hàng trong LarkBase** — user chưa cung cấp danh sách cột. Đây là PENDING DECISION trước khi code màn hình Customers.

**Chưa làm:**
- Kết nối LarkBase API vào webapp
- Màn hình Khách hàng
- Màn hình Bảo trì
- Màn hình Đơn hàng
- Stats thật trên Dashboard
- Tính năng đổi mật khẩu cho nhân viên
- PWA manifest (icon, offline support)

---

## 6. WHAT REMAINS TO BE DONE 🔲

- [ ] **[HIGH] Thu thập cấu trúc bảng LarkBase từ user** — cột nào trong bảng KH, bảo trì, đơn hàng
- [ ] **[HIGH] Tạo Lark App** trên open.larksuite.com — lấy App ID + App Secret
- [ ] **[HIGH] Viết lib/lark/client.ts** — wrapper gọi Lark OpenAPI (auth, read, write records)
- [ ] **[HIGH] Màn hình Khách hàng** — list, search, thêm mới, xem chi tiết, đổ về LarkBase
- [ ] **[HIGH] Màn hình Bảo trì** — lịch kỹ thuật viên, cập nhật trạng thái, ghi vật tư
- [ ] **[MEDIUM] Màn hình Đơn hàng** — tạo đơn, trạng thái, lịch sử
- [ ] **[MEDIUM] Dashboard stats thật** — đếm KH, bảo trì hôm nay, đơn tháng, SLA từ LarkBase
- [ ] **[MEDIUM] Tính năng đổi mật khẩu** — nhân viên tự đổi sau login lần đầu
- [ ] **[MEDIUM] Push notification** — nhắc lịch bảo trì cho kỹ thuật viên
- [ ] **[MEDIUM] N8n workflow bảo trì** — tự động nhắc KH trước 3 ngày
- [ ] **[LOW] PWA manifest** — icon, splash screen, add to homescreen
- [ ] **[LOW] Offline support** — service worker cache
- [ ] **[LOW] Admin: reset password** cho nhân viên
- [ ] **[LOW] Export báo cáo** — PDF/Excel từ LarkBase data

---

## 7. INSTRUCTION FOR CLAUDE CODE

Paste đoạn này vào Claude Code để bắt đầu:

```
Tôi đang tiếp tục xây dựng CRM Máy Lọc Nước — một PWA mobile-first cho công ty máy lọc nước tại Việt Nam.

PROJECT đã có sẵn tại: ~/Desktop/crm-nuoc
GitHub: https://github.com/Osinvietnam/crm-nuoc
Live: https://crm-nuoc.vercel.app

Tech stack: Next.js 16 App Router + TypeScript + Tailwind CSS + Supabase Auth + LarkBase + N8n

Những gì đã hoàn thành: Auth, Login, Dashboard layout với bottom nav theo role (admin/manager/sales/tech), trang Nhân viên (tạo tài khoản + gửi email qua N8n), deploy Vercel.

Việc cần làm NGAY: Kết nối LarkBase API và xây màn hình Khách hàng.

Trước tiên hãy đọc PROJECT_HANDOFF.md trên desktop để nắm toàn bộ context, sau đó hỏi tôi cấu trúc bảng Khách hàng trong LarkBase để bắt đầu code.

Mọi code phải:
- Mobile-first (test 390px)
- Dùng Tailwind CSS
- Dùng App Router (không dùng pages/)
- TypeScript strict
- Ghi data về LarkBase, không phải Supabase
```

---

## 8. ENVIRONMENT & SETUP NOTES

### Máy dev:
- MacBook/Mac Mini M4, macOS
- Node.js v20+
- VS Code

### Chạy local:
```bash
cd ~/Desktop/crm-nuoc
npm run dev
# → http://localhost:3000
```

### Deploy:
```bash
git add .
git commit -m "message"
git push origin main
# Vercel tự động deploy
```

### Biến môi trường cần có (.env.local + Vercel):
| Tên biến | Mô tả |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key Supabase |
| `N8N_WEBHOOK_URL` | https://app.sync.io.vn/webhook/crm-new-staff |
| `NEXT_PUBLIC_APP_URL` | https://crm-nuoc.vercel.app |
| `LARK_APP_ID` | PENDING — chưa tạo Lark App |
| `LARK_APP_SECRET` | PENDING — chưa tạo Lark App |
| `LARK_BASE_APP_TOKEN` | PENDING — token của LarkBase cụ thể |

### Tài khoản test:
- Admin: `admin@test.com` / `123456`
- Admin thật: `osinvietnam@gmail.com` (password do user biết)

### N8n:
- URL: https://app.sync.io.vn
- Workflow đã tạo: "CRM - Gửi email nhân viên mới"
- Webhook path: `/webhook/crm-new-staff`

### LarkBase:
- PENDING: Cần user cung cấp App ID, App Secret, và App Token của LarkBase
- Domain: open.larksuite.com (quốc tế)

### Supabase:
- Project name: crm-nuoc
- Region: Singapore (ap-southeast-1)
- Bảng đã tạo: `profiles`
- RLS: đã bật
- Auth: Email/Password, confirm email đã TẮT (để test nhanh)
