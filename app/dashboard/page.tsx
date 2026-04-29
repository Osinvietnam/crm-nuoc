'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PIPELINE_STAGES, PIPELINE_COLORS } from '@/lib/lark/tables'
import type { DashboardStats, MonthRevenue } from '@/app/api/dashboard/stats/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  admin:      'Quản trị viên',
  ceo:        'Giám đốc',
  director:   'Phó Giám đốc',
  accountant: 'Kế toán',
  sales:      'Kinh doanh',
  tech:       'Kỹ thuật',
  logistics:  'Hậu cần',
  partner:    'Đối tác',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  full_name:    string
  role:         string
  target_thang: number | null
}

interface KPICard {
  label:   string
  value:   string | number
  sub?:    string
  color:   string
  icon:    string
  href?:   string
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Shimmer({ className }: { className: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
  )
}

function SkeletonDashboard() {
  return (
    <div className="p-4 space-y-5">
      <Shimmer className="h-28 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Shimmer className="h-24" />
        <Shimmer className="h-24" />
        <Shimmer className="h-24" />
        <Shimmer className="h-24" />
      </div>
      <Shimmer className="h-40 rounded-2xl" />
      <Shimmer className="h-52 rounded-2xl" />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ'
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(0) + ' tr'
  if (n > 0)              return n.toLocaleString('vi-VN')
  return '0'
}

// ─── Revenue Chart ────────────────────────────────────────────────────────────

function RevenueChart({ data }: { data: MonthRevenue[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">Doanh số 6 tháng</p>
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 space-y-3">
        {data.map(({ label, value }) => {
          const pct = Math.round((value / max) * 100)
          return (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700 w-16 text-right flex-shrink-0">
                {value > 0 ? fmtMoney(value) : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function KPIGrid({ cards, loading }: { cards: KPICard[]; loading: boolean }) {
  const router = useRouter()
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">Tổng quan</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <button
            key={c.label}
            onClick={() => c.href && router.push(c.href)}
            className={`${c.color} rounded-2xl p-4 text-left active:scale-95 transition-transform`}
          >
            <span className="text-2xl">{c.icon}</span>
            <p className="text-2xl font-bold mt-2 leading-none">
              {loading ? <span className="text-base opacity-40">...</span> : c.value}
            </p>
            <p className="text-xs mt-1 font-semibold opacity-90">{c.label}</p>
            {c.sub && <p className="text-xs mt-0.5 opacity-60">{c.sub}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

function AlertsBanner({
  alerts, role, loading,
}: {
  alerts: { label: string; count: number; href: string; color: string }[]
  role: string
  loading: boolean
}) {
  const active = alerts.filter(a => a.count > 0)
  if (loading || active.length === 0) return null
  const router = useRouter()
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">Cần xử lý</p>
      {active.map(a => (
        <button
          key={a.label}
          onClick={() => router.push(a.href)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left ${a.color}`}
        >
          <span className="text-sm font-medium">{a.label}</span>
          <span className="text-sm font-bold">{a.count}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions({ role }: { role: string }) {
  const router = useRouter()

  const actionsByRole: Record<string, { label: string; icon: string; href: string }[]> = {
    admin:      [{ label: 'Khách hàng mới', icon: '👥', href: '/dashboard/customers' }, { label: 'Tạo báo giá', icon: '📋', href: '/dashboard/orders' }],
    ceo:        [{ label: 'Khách hàng mới', icon: '👥', href: '/dashboard/customers' }, { label: 'Tạo báo giá', icon: '📋', href: '/dashboard/orders' }],
    director:   [{ label: 'Khách hàng mới', icon: '👥', href: '/dashboard/customers' }, { label: 'Xem đơn hàng', icon: '📦', href: '/dashboard/orders' }],
    accountant: [],
    sales:      [{ label: 'Khách hàng mới', icon: '👥', href: '/dashboard/customers' }, { label: 'Tạo báo giá', icon: '📋', href: '/dashboard/orders' }],
    tech:       [{ label: 'Xem bảo trì', icon: '🔧', href: '/dashboard/maintenance' }, { label: 'Xem lịch', icon: '📅', href: '/dashboard/calendar' }],
    logistics:  [{ label: 'Xem đơn hàng', icon: '📦', href: '/dashboard/orders' }, { label: 'Xem lịch', icon: '📅', href: '/dashboard/calendar' }],
    partner:    [{ label: 'Khách hàng mới', icon: '👥', href: '/dashboard/customers' }],
  }

  const actions = actionsByRole[role] ?? []
  if (actions.length === 0) return null

  return (
    <div className="flex gap-3">
      {actions.map(a => (
        <button
          key={a.label}
          onClick={() => router.push(a.href)}
          className="flex-1 bg-white border border-gray-100 rounded-2xl px-3 py-3 flex items-center gap-2 shadow-sm active:scale-95 transition-transform"
        >
          <span className="text-xl">{a.icon}</span>
          <span className="text-sm font-medium text-gray-700">{a.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

function PipelineSection({ pipeline }: { pipeline: Record<string, number> }) {
  const router = useRouter()
  const data = PIPELINE_STAGES
    .map(stage => ({ stage, count: pipeline[stage] ?? 0 }))
    .filter(d => d.count > 0)
  const total = data.reduce((s, d) => s + d.count, 0)

  if (data.length === 0) return null

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">
        Pipeline khách hàng
        <span className="text-xs font-normal text-gray-400 ml-2">{total} KH</span>
      </p>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {data.map(({ stage, count }) => {
          const pct    = total > 0 ? Math.round((count / total) * 100) : 0
          const colors = PIPELINE_COLORS[stage as keyof typeof PIPELINE_COLORS]
            ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
          const barColor = colors.bg.replace('-50', '-400').replace('-100', '-400')
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
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-sm font-bold text-gray-700 w-8 text-right">{count}</span>
              <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── My Tasks widget ─────────────────────────────────────────────────────────

interface MyTaskItem {
  completion_id:     number
  label:             string
  customer_name:     string | null
  customer_record_id: number | null
  status:            string
}

function MyTasksWidget({ role }: { role: string }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<MyTaskItem[]>([])

  useEffect(() => {
    fetch('/api/tasks/my')
      .then(r => r.json())
      .then(d => setTasks((d.data ?? []).slice(0, 5)))
      .catch(() => {})
  }, [])

  const SHOW_ROLES = ['tech', 'logistics', 'sales', 'partner']
  if (!SHOW_ROLES.includes(role) || tasks.length === 0) return null

  const STATUS_DOT: Record<string, string> = {
    dang_lam: 'bg-amber-400',
    kiem_tra: 'bg-blue-400',
    blocked:  'bg-red-400',
    chua_lam: 'bg-gray-300',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">Việc cần làm</p>
        <button onClick={() => router.push('/dashboard/tasks')}
          className="text-xs text-blue-600 font-medium">Xem tất cả →</button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {tasks.map(t => (
          <button key={t.completion_id}
            onClick={() => t.customer_record_id && router.push(`/dashboard/customers/${t.customer_record_id}`)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[t.status] ?? 'bg-gray-300'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">{t.label}</p>
              {t.customer_name && (
                <p className="text-xs text-gray-400 truncate">{t.customer_name}</p>
              )}
            </div>
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Build cards per role ─────────────────────────────────────────────────────

function buildCards(role: string, s: DashboardStats, target: number | null): KPICard[] {
  const isManagerGroup = ['admin', 'ceo', 'director'].includes(role)

  if (isManagerGroup) return [
    { label: 'Khách hàng', value: s.total_customers,  sub: `+${s.new_customers_month} tháng này`, color: 'bg-blue-50 text-blue-600',   icon: '👥', href: '/dashboard/customers' },
    { label: 'Doanh số tháng', value: fmtMoney(s.revenue_month), sub: 'HĐ + Thương mại',         color: 'bg-green-50 text-green-600',  icon: '💰', href: '/dashboard/orders' },
    { label: 'Đơn tháng này', value: s.orders_month,  sub: 'HĐ + Thương mại',                    color: 'bg-purple-50 text-purple-600', icon: '📦', href: '/dashboard/orders' },
    { label: 'Bảo trì hôm nay', value: s.maintenance_today, sub: 'Công trình + Định kỳ',         color: 'bg-orange-50 text-orange-600', icon: '🔧', href: '/dashboard/maintenance' },
  ]

  if (role === 'accountant') return [
    { label: 'Doanh số tháng', value: fmtMoney(s.revenue_month), sub: 'HĐ + Thương mại',  color: 'bg-green-50 text-green-600',  icon: '💰', href: '/dashboard/orders' },
    { label: 'Chờ thanh toán', value: s.contracts_unpaid, sub: 'HĐ chưa thu đủ',          color: 'bg-red-50 text-red-600',      icon: '⏳', href: '/dashboard/orders' },
    { label: 'KH mới tháng',   value: s.new_customers_month, sub: 'Ngày liên hệ đầu',     color: 'bg-blue-50 text-blue-600',    icon: '👥', href: '/dashboard/customers' },
    { label: 'Đơn tháng này',  value: s.orders_month,  sub: 'HĐ + Thương mại',            color: 'bg-purple-50 text-purple-600', icon: '📦', href: '/dashboard/orders' },
  ]

  if (role === 'sales' || role === 'partner') {
    const targetPct = target && s.orders_month > 0
      ? `${Math.round((s.revenue_month / target) * 100)}% target`
      : target ? '0% target' : ''
    return [
      { label: 'KH của tôi',    value: s.total_customers,  sub: `+${s.new_customers_month} tháng`,  color: 'bg-blue-50 text-blue-600',   icon: '👥', href: '/dashboard/customers' },
      { label: 'Doanh số tháng', value: fmtMoney(s.revenue_month), sub: targetPct,                  color: 'bg-green-50 text-green-600',  icon: '💰', href: '/dashboard/orders' },
      { label: 'Báo giá chờ',   value: s.pending_quotes,   sub: 'Nháp + Đã gửi',                   color: 'bg-amber-50 text-amber-600',  icon: '📋', href: '/dashboard/orders' },
      { label: 'Đơn tháng',     value: s.orders_month,     sub: 'HĐ + Thương mại',                  color: 'bg-purple-50 text-purple-600', icon: '📦', href: '/dashboard/orders' },
    ]
  }

  if (role === 'tech') return [
    { label: 'Bảo trì hôm nay', value: s.maintenance_today,   sub: 'CT + Định kỳ',       color: 'bg-orange-50 text-orange-600', icon: '🔧', href: '/dashboard/maintenance' },
    { label: 'Tuần này',         value: s.maintenance_week,    sub: 'CT + Định kỳ',       color: 'bg-amber-50 text-amber-600',   icon: '📅', href: '/dashboard/calendar' },
    { label: 'Đang thi công',    value: s.construction_ongoing, sub: 'Công trình',         color: 'bg-blue-50 text-blue-600',    icon: '🏗️', href: '/dashboard/maintenance' },
    { label: 'Quá hạn',          value: s.maintenance_overdue, sub: 'Bảo trì định kỳ',   color: 'bg-red-50 text-red-600',      icon: '⚠️', href: '/dashboard/maintenance' },
  ]

  if (role === 'logistics') return [
    { label: 'Chờ giao',        value: s.logistics_pending,         sub: 'Chờ xác nhận + Chuẩn bị', color: 'bg-amber-50 text-amber-600',   icon: '📦', href: '/dashboard/orders' },
    { label: 'Đang giao',       value: s.logistics_delivering,      sub: 'Trên đường',               color: 'bg-blue-50 text-blue-600',     icon: '🚚', href: '/dashboard/orders' },
    { label: 'Đã giao tháng',   value: s.logistics_delivered_month, sub: 'Tháng này',                color: 'bg-green-50 text-green-600',   icon: '✅', href: '/dashboard/orders' },
    { label: 'Quá hạn giao',    value: s.logistics_overdue,         sub: 'Chưa giao đúng hẹn',       color: 'bg-red-50 text-red-600',       icon: '⚠️', href: '/dashboard/orders' },
  ]

  // Fallback
  return [
    { label: 'Khách hàng', value: s.total_customers, sub: `+${s.new_customers_month} tháng`, color: 'bg-blue-50 text-blue-600', icon: '👥', href: '/dashboard/customers' },
    { label: 'Báo giá chờ', value: s.pending_quotes,  sub: 'Nháp + Đã gửi',                  color: 'bg-amber-50 text-amber-600', icon: '📋', href: '/dashboard/orders' },
  ]
}

function buildAlerts(role: string, s: DashboardStats) {
  const base = [
    { label: `${s.kh_no_contact_30d} KH chưa liên hệ > 30 ngày`,  count: s.kh_no_contact_30d, href: '/dashboard/customers', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  ]

  if (['admin', 'ceo', 'director', 'tech'].includes(role)) {
    base.push({ label: `${s.maintenance_overdue} bảo trì định kỳ quá hạn`, count: s.maintenance_overdue, href: '/dashboard/maintenance', color: 'bg-red-50 text-red-700 border border-red-200' })
  }
  if (role === 'accountant') {
    base.push({ label: `${s.contracts_unpaid} hợp đồng chưa thu đủ`, count: s.contracts_unpaid, href: '/dashboard/orders', color: 'bg-red-50 text-red-700 border border-red-200' })
  }
  if (role === 'sales' || role === 'partner') {
    base.push({ label: `${s.quotes_stale} báo giá đã gửi chưa phản hồi`, count: s.quotes_stale, href: '/dashboard/orders', color: 'bg-blue-50 text-blue-700 border border-blue-200' })
  }
  if (['admin', 'ceo', 'director'].includes(role) && s.quotes_cho_duyet > 0) {
    base.unshift({ label: `${s.quotes_cho_duyet} báo giá chờ duyệt`, count: s.quotes_cho_duyet, href: '/dashboard/orders', color: 'bg-orange-50 text-orange-700 border border-orange-300' })
  }
  if (role === 'logistics') {
    base.push({ label: `${s.logistics_overdue} đơn giao quá hạn`, count: s.logistics_overdue, href: '/dashboard/orders', color: 'bg-red-50 text-red-700 border border-red-200' })
  }

  return base
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats,   setStats]   = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, target_thang')
        .eq('id', user.id)
        .single()
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

  if (loading) return <SkeletonDashboard />

  const role    = profile?.role ?? 'sales'
  const cards   = stats ? buildCards(role, stats, profile?.target_thang ?? null) : []
  const alerts  = stats ? buildAlerts(role, stats) : []
  const showRevChart   = ['admin', 'ceo', 'director', 'accountant'].includes(role)
  const showPipeline   = ['admin', 'ceo', 'director', 'accountant', 'sales', 'partner'].includes(role)

  // Target progress bar cho sales
  const targetPct = profile?.target_thang && stats?.revenue_month
    ? Math.min(Math.round((stats.revenue_month / profile.target_thang) * 100), 100)
    : null

  return (
    <div className="p-4 space-y-5 pb-24">

      {/* ── Greeting ── */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between">
          <p className="text-blue-200 text-sm">Xin chào,</p>
          {role && (
            <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
              {ROLE_LABEL[role] ?? role}
            </span>
          )}
        </div>
        <p className="text-xl font-bold mt-0.5">{profile?.full_name ?? '...'}</p>
        <p className="text-blue-200 text-xs mt-2">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>

        {/* Target progress cho sales */}
        {targetPct !== null && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-blue-200 text-xs">Target tháng này</p>
              <p className="text-white text-xs font-bold">{targetPct}%</p>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  targetPct >= 100 ? 'bg-green-400' : targetPct >= 60 ? 'bg-white' : 'bg-amber-300'
                }`}
                style={{ width: `${targetPct}%` }}
              />
            </div>
            <p className="text-blue-200 text-xs mt-1">
              {fmtMoney(stats?.revenue_month ?? 0)} / {fmtMoney(profile?.target_thang ?? 0)} đ
            </p>
          </div>
        )}
      </div>

      {/* ── Alerts ── */}
      <AlertsBanner alerts={alerts} role={role} loading={loading} />

      {/* ── Quick actions ── */}
      <QuickActions role={role} />

      {/* ── Việc cần làm (tech/logistics/sales) ── */}
      <MyTasksWidget role={role} />

      {/* ── KPI cards ── */}
      {cards.length > 0 && <KPIGrid cards={cards} loading={false} />}

      {/* ── Revenue chart ── */}
      {showRevChart && stats && stats.revenue_6months.some(m => m.value > 0) && (
        <RevenueChart data={stats.revenue_6months} />
      )}

      {/* ── Pipeline ── */}
      {showPipeline && stats && <PipelineSection pipeline={stats.pipeline} />}

    </div>
  )
}
