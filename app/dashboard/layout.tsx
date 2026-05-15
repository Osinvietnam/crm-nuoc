'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ToastProvider } from '@/components/Toast'
import { NotificationPanel } from '@/components/NotificationPanel'

interface Profile {
  full_name: string
  role: string
  email: string
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile,      setProfile]      = useState<Profile | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [unreadCount,  setUnreadCount]  = useState(0)
  const [userId,       setUserId]       = useState<string | null>(null)
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, email')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)

      // Fetch initial unread count
      const res  = await fetch('/api/notifications?limit=1')
      const json = await res.json()
      if (res.ok) setUnreadCount(json.unread_count ?? 0)
    }
    getProfile()
  }, [])

  // Supabase Realtime — lắng nghe INSERT vào notifications cho user hiện tại
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('notifications-inbox')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => setUnreadCount(n => n + 1)
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId])

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/login')
  }

  const menuByRole: Record<string, { href: string; label: string; icon: string }[]> = {
    admin: [
      { href: '/dashboard',             label: 'Tổng quan',  icon: '📊' },
      { href: '/dashboard/customers',   label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/quotes',      label: 'Báo giá',    icon: '📋' },
      { href: '/dashboard/contracts',   label: 'Hợp đồng',   icon: '📄' },
      { href: '/dashboard/products',    label: 'Sản phẩm',   icon: '🗂️' },
      { href: '/dashboard/maintenance', label: 'Bảo trì',    icon: '🔧' },
      { href: '/dashboard/warranty',    label: 'Bảo hành',   icon: '🛡️' },
      { href: '/dashboard/finance',     label: 'Tài chính',  icon: '💰' },
      { href: '/dashboard/staff',       label: 'Nhân viên',  icon: '👤' },
      { href: '/dashboard/tasks',       label: 'Công việc',  icon: '✅' },
      { href: '/dashboard/calendar',    label: 'Lịch',       icon: '📅' },
      { href: '/dashboard/admin',       label: 'Quản trị',   icon: '⚙️' },
    ],
    ceo: [
      { href: '/dashboard',             label: 'Tổng quan',  icon: '📊' },
      { href: '/dashboard/customers',   label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/quotes',      label: 'Báo giá',    icon: '📋' },
      { href: '/dashboard/contracts',   label: 'Hợp đồng',   icon: '📄' },
      { href: '/dashboard/products',    label: 'Sản phẩm',   icon: '🗂️' },
      { href: '/dashboard/maintenance', label: 'Bảo trì',    icon: '🔧' },
      { href: '/dashboard/warranty',    label: 'Bảo hành',   icon: '🛡️' },
      { href: '/dashboard/finance',     label: 'Tài chính',  icon: '💰' },
      { href: '/dashboard/staff',       label: 'Nhân viên',  icon: '👤' },
      { href: '/dashboard/tasks',       label: 'Công việc',  icon: '✅' },
      { href: '/dashboard/calendar',    label: 'Lịch',       icon: '📅' },
    ],
    director: [
      { href: '/dashboard',             label: 'Tổng quan',  icon: '📊' },
      { href: '/dashboard/customers',   label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/quotes',      label: 'Báo giá',    icon: '📋' },
      { href: '/dashboard/contracts',   label: 'Hợp đồng',   icon: '📄' },
      { href: '/dashboard/products',    label: 'Sản phẩm',   icon: '🗂️' },
      { href: '/dashboard/maintenance', label: 'Bảo trì',    icon: '🔧' },
      { href: '/dashboard/warranty',    label: 'Bảo hành',   icon: '🛡️' },
      { href: '/dashboard/finance',     label: 'Tài chính',  icon: '💰' },
      { href: '/dashboard/staff',       label: 'Nhân viên',  icon: '👤' },
      { href: '/dashboard/tasks',       label: 'Công việc',  icon: '✅' },
      { href: '/dashboard/calendar',    label: 'Lịch',       icon: '📅' },
    ],
    accountant: [
      { href: '/dashboard',           label: 'Tổng quan',  icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/quotes',    label: 'Báo giá',    icon: '📋' },
      { href: '/dashboard/contracts', label: 'Hợp đồng',   icon: '📄' },
      { href: '/dashboard/finance',   label: 'Tài chính',  icon: '💰' },
      { href: '/dashboard/staff',     label: 'Nhân viên',  icon: '👤' },
    ],
    sales: [
      { href: '/dashboard',           label: 'Tổng quan',  icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/quotes',    label: 'Báo giá',    icon: '📋' },
      { href: '/dashboard/contracts', label: 'Hợp đồng',   icon: '📄' },
      { href: '/dashboard/tasks',     label: 'Công việc',  icon: '✅' },
      { href: '/dashboard/products',  label: 'Sản phẩm',   icon: '🗂️' },
    ],
    tech: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/tasks', label: 'Công việc', icon: '✅' },
      { href: '/dashboard/maintenance', label: 'Bảo trì', icon: '🔧' },
      { href: '/dashboard/warranty', label: 'Bảo hành', icon: '🛡️' },
      { href: '/dashboard/calendar', label: 'Lịch', icon: '📅' },
    ],
    logistics: [
      { href: '/dashboard',             label: 'Tổng quan',  icon: '📊' },
      { href: '/dashboard/customers',   label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/tasks',       label: 'Công việc',  icon: '✅' },
      { href: '/dashboard/contracts',   label: 'Hợp đồng',   icon: '📄' },
      { href: '/dashboard/maintenance', label: 'Bảo trì',    icon: '🔧' },
      { href: '/dashboard/warranty',    label: 'Bảo hành',   icon: '🛡️' },
      { href: '/dashboard/calendar',    label: 'Lịch',       icon: '📅' },
    ],
    partner: [
      { href: '/dashboard',           label: 'Tổng quan',  icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/contracts', label: 'Hợp đồng',   icon: '📄' },
      { href: '/dashboard/calendar',  label: 'Lịch',       icon: '📅' },
    ],
  }

  const roleLabel: Record<string, string> = {
    admin:      'Quản trị viên',
    ceo:        'Giám đốc',
    director:   'Giám đốc / Quản lý',
    accountant: 'Kế toán',
    sales:      'Kinh doanh',
    tech:       'Kỹ thuật',
    logistics:  'Hậu cần',
    partner:    'Đối tác',
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <span className="crm-spinner" />
    </div>
  )

  const menu = menuByRole[profile?.role ?? 'sales'] ?? []
  const initials = profile?.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() ?? 'U'

  return (
    <ToastProvider>
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Desktop Sidebar (lg+) ─────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col fixed left-0 top-0 bottom-0 w-56 bg-white border-r border-gray-100 z-20">

        {/* User info */}
        <button
          onClick={() => router.push('/dashboard/profile')}
          className="flex items-center gap-3 px-4 py-5 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 shrink-0"
        >
          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-none truncate">{profile?.full_name}</p>
            <p className="text-xs text-blue-600 mt-0.5">{roleLabel[profile?.role ?? 'sales']}</p>
          </div>
        </button>

        {/* Menu items */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {menu.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Notification + Logout */}
        <div className="p-2 border-t border-gray-100 shrink-0 space-y-0.5">
          <div className="flex items-center gap-2 px-3 py-2">
            <NotificationPanel unreadCount={unreadCount} onCountChange={setUnreadCount} />
            <span className="text-sm text-gray-600">Thông báo</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors text-left"
          >
            <span className="text-lg">🚪</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-56">

        {/* Header — mobile only */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <button
            onClick={() => router.push('/dashboard/profile')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 leading-none">{profile?.full_name}</p>
              <p className="text-xs text-blue-600 mt-0.5">{roleLabel[profile?.role ?? 'sales']}</p>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <NotificationPanel unreadCount={unreadCount} onCountChange={setUnreadCount} />
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-red-50"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto content-safe lg:pb-8 lg:pt-6">
          <div className="max-w-2xl mx-auto w-full">
            {children}
          </div>
        </main>

        {/* Bottom Navigation — mobile only */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 nav-safe z-10">
          <div className="max-w-2xl mx-auto flex overflow-x-auto scrollbar-none px-1 pt-1">
            {menu.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex flex-col items-center py-2 rounded-xl transition-colors flex-shrink-0 ${
                    menu.length <= 5 ? 'flex-1 px-1' : 'px-4'
                  } ${isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <span className="text-xl leading-none">{item.icon}</span>
                  <span className="text-xs mt-1 font-semibold whitespace-nowrap">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

      </div>
    </div>
    </ToastProvider>
  )
}
