'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  full_name: string
  role: string
}

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

      {/* Chào mừng */}
      <div className="bg-blue-600 rounded-2xl p-5 text-white">
        <p className="text-blue-200 text-sm">Xin chào,</p>
        <p className="text-xl font-bold mt-0.5">{profile?.full_name ?? '...'}</p>
        <p className="text-blue-200 text-xs mt-2">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', year: 'numeric',
            month: 'long', day: 'numeric'
          })}
        </p>
      </div>

      {/* Stats */}
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

      {/* Hoạt động gần đây */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Hoạt động gần đây</p>
        <div className="bg-white rounded-2xl divide-y divide-gray-100">
          {[1,2,3].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-base">
                🔧
              </div>
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