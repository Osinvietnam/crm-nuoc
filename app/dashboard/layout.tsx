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

      {/* Header */}
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

      {/* Content */}
      <main className="flex-1 overflow-auto pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
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