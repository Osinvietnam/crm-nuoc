'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PIPELINE_STAGES, PIPELINE_COLORS } from '@/lib/lark/tables'
import type { DashboardStats } from '@/app/api/dashboard/stats/route'

interface Profile {
  full_name:    string
  role:         string
  target_thang: number | null
}

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

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats,   setStats]   = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles').select('full_name, role, target_thang')
        .eq('id', user.id).single()
      setProfile(data)

      try {
        const res = await fetch('/api/dashboard/stats')
        const d   = await res.json()
        setStats(d.data ?? null)
      } catch { /* stats không hiện nếu lỗi */ }
      finally { setLoading(false) }
    }
    init()
  }, [])

  const cards = [
    {
      label:   'Khách hàng',
      value:   stats?.total_customers ?? '—',
      sub:     stats ? `+${stats.new_customers_month} trong tháng` : '',
      color:   'bg-blue-50 text-blue-600',
      icon:    '👥',
      onClick: () => router.push('/dashboard/customers'),
    },
    {
      label:   'Báo giá chờ',
      value:   stats?.pending_quotes ?? '—',
      sub:     'Nháp + Gửi KH',
      color:   'bg-amber-50 text-amber-600',
      icon:    '📋',
      onClick: () => router.push('/dashboard/orders'),
    },
    {
      label:   'Đơn tháng này',
      value:   stats?.orders_month ?? '—',
      sub:     'HĐ + Thương mại',
      color:   'bg-green-50 text-green-600',
      icon:    '📦',
      onClick: () => router.push('/dashboard/orders'),
    },
    {
      label:   'Bảo trì hôm nay',
      value:   stats?.maintenance_today ?? '—',
      sub:     'Công trình + Định kỳ',
      color:   'bg-orange-50 text-orange-600',
      icon:    '🔧',
      onClick: () => router.push('/dashboard/maintenance'),
    },
  ]

  // Pipeline: chỉ lấy các stage có dữ liệu, tối đa 6 stage để gọn
  const pipelineData = stats
    ? PIPELINE_STAGES
        .map(stage => ({ stage, count: stats.pipeline[stage] ?? 0 }))
        .filter(d => d.count > 0)
    : []

  const pipelineTotal = pipelineData.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="p-4 space-y-5">

      {/* Chào mừng */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between">
          <p className="text-blue-200 text-sm">Xin chào,</p>
          {profile?.role && (
            <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
              {ROLE_LABEL[profile.role] ?? profile.role}
            </span>
          )}
        </div>
        <p className="text-xl font-bold mt-0.5">{profile?.full_name ?? '...'}</p>
        <p className="text-blue-200 text-xs mt-2">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', year: 'numeric',
            month: 'long', day: 'numeric',
          })}
        </p>
        {/* Target tháng cho sales */}
        {profile?.target_thang && profile.role === 'sales' && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <p className="text-blue-200 text-xs">Target tháng này</p>
            <p className="text-white font-bold text-sm mt-0.5">
              {profile.target_thang.toLocaleString('vi-VN')} đ
            </p>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Tổng quan</p>
        <div className="grid grid-cols-2 gap-3">
          {cards.map(c => (
            <button
              key={c.label}
              onClick={c.onClick}
              className={`${c.color} rounded-2xl p-4 text-left active:scale-95 transition-transform`}
            >
              <span className="text-2xl">{c.icon}</span>
              <p className="text-2xl font-bold mt-2 leading-none">
                {loading ? <span className="text-lg opacity-50">...</span> : c.value}
              </p>
              <p className="text-xs mt-1 font-semibold opacity-90">{c.label}</p>
              {c.sub && <p className="text-xs mt-0.5 opacity-60">{c.sub}</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline distribution */}
      {pipelineData.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Pipeline khách hàng
            <span className="text-xs font-normal text-gray-400 ml-2">{pipelineTotal} KH</span>
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {pipelineData.map(({ stage, count }) => {
              const pct = pipelineTotal > 0 ? Math.round((count / pipelineTotal) * 100) : 0
              const colors = PIPELINE_COLORS[stage as keyof typeof PIPELINE_COLORS] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
              return (
                <button
                  key={stage}
                  onClick={() => router.push('/dashboard/customers')}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50"
                >
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${colors.bg} ${colors.text} min-w-[80px] text-left`}>
                    {stage}
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colors.bg.replace('bg-', 'bg-').replace('-50', '-400').replace('-100', '-400')}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-700 w-8 text-right">{count}</span>
                  <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Skeleton khi chưa có pipeline data */}
      {!loading && pipelineData.length === 0 && stats && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-6 text-center">
          <p className="text-sm text-gray-400">Chưa có dữ liệu pipeline</p>
        </div>
      )}
    </div>
  )
}
