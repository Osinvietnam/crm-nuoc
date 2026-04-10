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
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: '📦' },
      { href: '/dashboard/maintenance', label: 'Bảo trì', icon: '🔧' },
      { href: '/dashboard/products', label: 'Sản phẩm', icon: '🗂️' },
      { href: '/dashboard/staff', label: 'Nhân viên', icon: '👤' },
      { href: '/dashboard/admin', label: 'Quản trị', icon: '⚙️' },
    ],
    ceo: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/calendar', label: 'Lịch', icon: '📅' },
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: '📦' },
      { href: '/dashboard/maintenance', label: 'Bảo trì', icon: '🔧' },
      { href: '/dashboard/products', label: 'Sản phẩm', icon: '🗂️' },
      { href: '/dashboard/staff', label: 'Nhân viên', icon: '👤' },
    ],
    tech_lead: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/calendar', label: 'Lịch', icon: '📅' },
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: '📦' },
      { href: '/dashboard/maintenance', label: 'Bảo trì', icon: '🔧' },
      { href: '/dashboard/staff', label: 'Nhân viên', icon: '👤' },
    ],
    accountant: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/calendar', label: 'Lịch', icon: '📅' },
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: '📦' },
      { href: '/dashboard/staff', label: 'Nhân viên', icon: '👤' },
    ],
    sales: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/calendar', label: 'Lịch', icon: '📅' },
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: '📦' },
      { href: '/dashboard/products', label: 'Sản phẩm', icon: '🗂️' },
      { href: '/dashboard/staff', label: 'Nhân viên', icon: '👤' },
    ],
    tech: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/maintenance', label: 'Bảo trì', icon: '🔧' },
      { href: '/dashboard/calendar', label: 'Lịch', icon: '📅' },
      { href: '/dashboard/staff', label: 'Nhân viên', icon: '👤' },
    ],
    logistics: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: '📦' },
      { href: '/dashboard/calendar', label: 'Lịch', icon: '📅' },
      { href: '/dashboard/staff', label: 'Nhân viên', icon: '👤' },
    ],
    partner: [
      { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: '👥' },
      { href: '/dashboard/calendar', label: 'Lịch', icon: '📅' },
      { href: '/dashboard/staff', label: 'Nhân viên', icon: '👤' },
    ],
  }

  const roleLabel: Record<string, string> = {
    admin:      'Quản trị viên',
    ceo:        'Giám đốc',
    tech_lead:  'Trưởng phòng KT',
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => router.push('/dashboard/profile')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {profile?.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() ?? 'U'}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 leading-none">{profile?.full_name}</p>
            <p className="text-xs text-blue-600 mt-0.5">{roleLabel[profile?.role ?? 'sales']}</p>
          </div>
        </button>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          Đăng xuất
        </button>
      </header>

      {/* Content — content-safe phủ đủ chiều cao nav + iPhone notch */}
      <main className="flex-1 overflow-auto content-safe">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 nav-safe z-10">
        <div className="flex overflow-x-auto scrollbar-none px-1 pt-1">
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
                <span className="text-[10px] mt-1 font-semibold whitespace-nowrap">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}