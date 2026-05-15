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
  director:   'Giám đốc / Quản lý',
  tech_lead:  'Trưởng phòng KT',
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
  label:     string
  value:     string | number
  sub?:      string
  color:     string
  icon:      string
  href?:     string
  progress?: number   // 0–100, hiển thị OKR progress bar nếu có
}

type AlertSeverity = 'urgent' | 'important' | 'watch'

interface AlertItem {
  label:     string
  count:     number
  valueStr?: string   // hiển thị thay count (dùng cho tiền tệ)
  href:      string
  severity:  AlertSeverity
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
            {c.progress !== undefined && (
              <div className="mt-2">
                <div className="h-1 bg-black/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      c.progress >= 100 ? 'bg-green-500' : c.progress >= 60 ? 'bg-current opacity-50' : 'bg-amber-400'
                    }`}
                    style={{ width: `${Math.min(c.progress, 100)}%` }}
                  />
                </div>
                <p className="text-xs mt-0.5 opacity-60">{Math.min(c.progress, 100)}% KPI</p>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── War Room ─────────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<AlertSeverity, { heading: string; ring: string; badge: string }> = {
  urgent:    { heading: '🔴 Khẩn cấp',   ring: 'border-red-200 bg-red-50',     badge: 'bg-red-500 text-white'     },
  important: { heading: '🟠 Quan trọng', ring: 'border-orange-200 bg-orange-50', badge: 'bg-orange-500 text-white' },
  watch:     { heading: '🟡 Theo dõi',   ring: 'border-yellow-200 bg-yellow-50', badge: 'bg-yellow-400 text-gray-800' },
}

function WarRoom({ alerts, loading }: { alerts: AlertItem[]; loading: boolean }) {
  const [open, setOpen] = useState(true)
  const router = useRouter()
  const active = alerts.filter(a => a.count > 0)
  if (loading || active.length === 0) return null

  const byGroup = (sev: AlertSeverity) => active.filter(a => a.severity === sev)
  const urgentCnt    = byGroup('urgent').length
  const importantCnt = byGroup('important').length

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 active:bg-gray-100"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">⚡ Cần xử lý</span>
          {urgentCnt > 0 && (
            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">
              {urgentCnt}
            </span>
          )}
          {importantCnt > 0 && (
            <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">
              {importantCnt}
            </span>
          )}
        </div>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-3 space-y-3 bg-white">
          {(['urgent', 'important', 'watch'] as AlertSeverity[]).map(sev => {
            const items = byGroup(sev)
            if (items.length === 0) return null
            const cfg = SEV_CONFIG[sev]
            return (
              <div key={sev}>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">{cfg.heading}</p>
                <div className="space-y-1.5">
                  {items.map(a => (
                    <button
                      key={a.label}
                      onClick={() => router.push(a.href)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left ${cfg.ring}`}
                    >
                      <span className="text-sm font-medium text-gray-800">{a.label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${cfg.badge}`}>
                        {a.valueStr ?? a.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions({ role }: { role: string }) {
  const router = useRouter()

  const actionsByRole: Record<string, { label: string; icon: string; href: string }[]> = {
    admin:      [{ label: 'Khách hàng mới', icon: '👥', href: '/dashboard/customers' }, { label: 'Tạo báo giá', icon: '📋', href: '/dashboard/contracts' }],
    ceo:        [{ label: 'Khách hàng mới', icon: '👥', href: '/dashboard/customers' }, { label: 'Tạo báo giá', icon: '📋', href: '/dashboard/contracts' }],
    director:   [{ label: 'Khách hàng mới', icon: '👥', href: '/dashboard/customers' }, { label: 'Xem đơn hàng', icon: '📦', href: '/dashboard/contracts' }],
    accountant: [{ label: 'Ghi thu', icon: '💵', href: '/dashboard/finance' }, { label: 'Xem công nợ', icon: '📊', href: '/dashboard/finance' }],
    sales:      [{ label: 'Khách hàng mới', icon: '👥', href: '/dashboard/customers' }, { label: 'Tạo báo giá', icon: '📋', href: '/dashboard/contracts' }],
    tech_lead:  [{ label: 'Xem bảo trì', icon: '🔧', href: '/dashboard/maintenance' }, { label: 'Xem lịch', icon: '📅', href: '/dashboard/calendar' }],
    tech:       [{ label: 'Xem bảo trì', icon: '🔧', href: '/dashboard/maintenance' }, { label: 'Xem lịch', icon: '📅', href: '/dashboard/calendar' }],
    logistics:  [{ label: 'Xem đơn hàng', icon: '📦', href: '/dashboard/contracts' }, { label: 'Xem bảo trì', icon: '🔧', href: '/dashboard/maintenance' }],
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

  const SHOW_ROLES = ['tech_lead', 'tech', 'logistics', 'sales', 'partner']
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

// ─── Mini Calendar ───────────────────────────────────────────────────────────

interface TodayEvent {
  date:  number
  type:  string
  title: string
  sub:   string
  href:  string
  color: string
}

const EVENT_LABEL: Record<string, string> = {
  quote:         'BG follow-up',
  quote_expire:  'BG hết hạn',
  contract:      'Giao hàng B2C',
  contract_sign: 'Ký HĐ',
  delivery_tm:   'Giao hàng TM',
  construction:  'Bảo trì CT',
  acceptance:    'Nghiệm thu',
  periodic:      'Bảo dưỡng ĐK',
  warranty:      'Bảo hành',
  payment_due:   'Đến hạn TT',
  task_due:      'Task đến hạn',
  project_sign:  'Ký HĐ dự án',
  project_start: 'Khởi công',
  project_end:   'Hoàn thành DK',
}

function MiniCalendar() {
  const [events, setEvents] = useState<TodayEvent[]>([])
  const router = useRouter()

  useEffect(() => {
    const now     = new Date()
    const month   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const todayStr = now.toISOString().split('T')[0]
    fetch(`/api/calendar?month=${month}`)
      .then(r => r.json())
      .then(d => {
        const filtered = ((d.events ?? []) as TodayEvent[])
          .filter(e => new Date(e.date).toISOString().split('T')[0] === todayStr)
          .slice(0, 6)
        setEvents(filtered)
      })
      .catch(() => {})
  }, [])

  if (events.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">📅 Lịch hôm nay</p>
        <button onClick={() => router.push('/dashboard/calendar')}
          className="text-xs text-blue-600 font-medium">Xem lịch →</button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {events.map((e, i) => (
          <button key={i} onClick={() => e.href && router.push(e.href)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${e.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate font-medium">{e.title}</p>
              <p className="text-xs text-gray-400 truncate">{EVENT_LABEL[e.type] ?? e.type} · {e.sub}</p>
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

// ─── Conversion Funnel ────────────────────────────────────────────────────────

const FUNNEL_STAGES = [
  'Lead mới','Tiềm năng','Báo giá','Đàm phán',
  'Chốt HĐ','Giao hàng','Nghiệm thu','Bảo hành','Bảo trì',
]

function ConversionFunnel({ pipeline }: { pipeline: Record<string, number> }) {
  const total = FUNNEL_STAGES.reduce((s, st) => s + (pipeline[st] ?? 0), 0)
  if (total === 0) return null

  const funnel = FUNNEL_STAGES.map((stage, i) => {
    const reached = FUNNEL_STAGES.slice(i).reduce((s, st) => s + (pipeline[st] ?? 0), 0)
    return { stage, count: pipeline[stage] ?? 0, rate: Math.round(reached / total * 100) }
  }).filter(f => f.count > 0)

  if (funnel.length < 2) return null

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">Phễu chuyển đổi</p>
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 space-y-2.5">
        {funnel.map(({ stage, count, rate }) => (
          <div key={stage} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-24 flex-shrink-0 truncate">{stage}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-400 transition-all duration-500"
                style={{ width: `${rate}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-700 w-7 text-right flex-shrink-0">{count}</span>
            <span className="text-xs text-gray-400 w-9 text-right flex-shrink-0">{rate}%</span>
          </div>
        ))}
        <p className="text-xs text-gray-400 pt-1.5 border-t border-gray-50">
          Tổng {total} KH active
        </p>
      </div>
    </div>
  )
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

type FeedItem = DashboardStats['activity_feed'][0]

const ACTION_ICON: Record<string, string> = {
  customer_created:        '👤',
  customer_updated:        '✏️',
  customer_reassigned:     '🔄',
  order_created:           '📋',
  order_updated:           '📝',
  payment_created:         '💰',
  payment_updated:         '💵',
  payment_deleted:         '🗑️',
  quote_created:           '📄',
  quote_updated:           '📝',
  quote_status_changed:    '🔄',
  warranty_ticket_created: '🛡️',
  warranty_ticket_updated: '🔧',
  commission_paid:         '💸',
  task_updated:            '✅',
  asset_created:           '🏷️',
  expense_created:         '📊',
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m    = Math.floor(diff / 60_000)
  const h    = Math.floor(diff / 3_600_000)
  const d    = Math.floor(diff / 86_400_000)
  if (m < 1)  return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  if (h < 24) return `${h} giờ trước`
  return `${d} ngày trước`
}

function ActivityFeed({ feed }: { feed: FeedItem[] }) {
  if (feed.length === 0) return null
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">Hoạt động gần đây</p>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {feed.map((item, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <span className="text-lg flex-shrink-0 mt-0.5">
              {ACTION_ICON[item.action] ?? '📌'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700">{item.user_name}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{item.detail}</p>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5 whitespace-nowrap">
              {relativeTime(item.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── P&L Widget ───────────────────────────────────────────────────────────────

type PLSummary = NonNullable<DashboardStats['pl_summary']>

function PLWidget({ pl }: { pl: PLSummary }) {
  const isProfit = pl.loi_nhuan >= 0
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">P&L tháng này</p>
      <div className={`rounded-2xl p-4 border ${
        isProfit
          ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
          : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100'
      }`}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Lợi nhuận ròng</p>
            <p className={`text-2xl font-bold leading-none ${isProfit ? 'text-green-700' : 'text-red-700'}`}>
              {isProfit ? '+' : ''}{fmtMoney(pl.loi_nhuan)}đ
            </p>
          </div>
          <div className={`text-right ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
            <span className="text-xl">{isProfit ? '📈' : '📉'}</span>
            <p className="text-sm font-bold">{Math.abs(pl.bien_loi_nhuan_pct)}%</p>
          </div>
        </div>
        <div className="space-y-1.5 pt-3 border-t border-black/5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">💰 Doanh thu</span>
            <span className="font-semibold text-gray-700">{fmtMoney(pl.doanh_thu)}đ</span>
          </div>
          {pl.chi_phi > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">🧾 Chi phí</span>
              <span className="font-semibold text-gray-700">−{fmtMoney(pl.chi_phi)}đ</span>
            </div>
          )}
          {pl.hoa_hong > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">💸 Hoa hồng đã trả</span>
              <span className="font-semibold text-gray-700">−{fmtMoney(pl.hoa_hong)}đ</span>
            </div>
          )}
          {pl.khau_hao > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">🏷️ Khấu hao</span>
              <span className="font-semibold text-gray-700">−{fmtMoney(pl.khau_hao)}đ</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Build cards per role ─────────────────────────────────────────────────────

function buildCards(role: string, s: DashboardStats, target: number | null): KPICard[] {
  const kpi  = s.kpi_target
  const isMgr = ['admin', 'ceo', 'director'].includes(role)
  // Helper: compute OKR %, undefined nếu không có target
  const pct = (actual: number, t: number | null | undefined): number | undefined =>
    t ? Math.round(actual / t * 100) : undefined

  if (isMgr) return [
    { label: 'Khách hàng',      value: s.total_customers,          sub: `+${s.new_customers_month} tháng này`, color: 'bg-blue-50 text-blue-600',    icon: '👥', href: '/dashboard/customers', progress: pct(s.new_customers_month, kpi?.target_customers) },
    { label: 'Doanh số tháng',  value: fmtMoney(s.revenue_month),  sub: 'HĐ + Thương mại',                     color: 'bg-green-50 text-green-600',   icon: '💰', href: '/dashboard/contracts',  progress: pct(s.revenue_month, kpi?.target_revenue)    },
    { label: 'Đơn tháng này',   value: s.orders_month,              sub: 'HĐ + Thương mại',                     color: 'bg-purple-50 text-purple-600', icon: '📦', href: '/dashboard/contracts',  progress: pct(s.orders_month, kpi?.target_contracts)   },
    { label: 'Bảo trì hôm nay', value: s.maintenance_today,         sub: 'Công trình + Định kỳ',                color: 'bg-orange-50 text-orange-600', icon: '🔧', href: '/dashboard/maintenance'                                                          },
  ]

  if (role === 'accountant') return [
    { label: 'Doanh số tháng', value: fmtMoney(s.revenue_month), sub: 'HĐ + Thương mại', color: 'bg-green-50 text-green-600',   icon: '💰', href: '/dashboard/contracts',  progress: pct(s.revenue_month, kpi?.target_revenue) },
    { label: 'Chờ thanh toán', value: s.contracts_unpaid,         sub: 'HĐ chưa thu đủ', color: 'bg-red-50 text-red-600',       icon: '⏳', href: '/dashboard/contracts'  },
    { label: 'KH mới tháng',   value: s.new_customers_month,      sub: 'Ngày liên hệ đầu', color: 'bg-blue-50 text-blue-600',  icon: '👥', href: '/dashboard/customers'  },
    { label: 'Đơn tháng này',  value: s.orders_month,             sub: 'HĐ + Thương mại', color: 'bg-purple-50 text-purple-600', icon: '📦', href: '/dashboard/contracts'  },
  ]

  if (role === 'sales' || role === 'partner') {
    const revTarget = kpi?.target_revenue ?? target
    return [
      { label: 'KH của tôi',     value: s.total_customers,          sub: `+${s.new_customers_month} tháng`, color: 'bg-blue-50 text-blue-600',    icon: '👥', href: '/dashboard/customers', progress: pct(s.new_customers_month, kpi?.target_customers) },
      { label: 'Doanh số tháng', value: fmtMoney(s.revenue_month),  sub: 'Tháng này',                       color: 'bg-green-50 text-green-600',   icon: '💰', href: '/dashboard/contracts',  progress: pct(s.revenue_month, revTarget)                },
      { label: 'Báo giá chờ',    value: s.pending_quotes,            sub: 'Nháp + Đã gửi',                   color: 'bg-amber-50 text-amber-600',  icon: '📋', href: '/dashboard/contracts'                                                                  },
      { label: 'Đơn tháng',      value: s.orders_month,              sub: 'HĐ + Thương mại',                 color: 'bg-purple-50 text-purple-600', icon: '📦', href: '/dashboard/contracts',  progress: pct(s.orders_month, kpi?.target_contracts)     },
    ]
  }

  if (role === 'tech_lead') return [
    { label: 'Bảo trì hôm nay', value: s.maintenance_today,         sub: 'CT + Định kỳ',       color: 'bg-orange-50 text-orange-600', icon: '🔧', href: '/dashboard/maintenance' },
    { label: 'Đang thi công',    value: s.construction_ongoing,      sub: 'Công trình',          color: 'bg-blue-50 text-blue-600',     icon: '🏗️', href: '/dashboard/maintenance' },
    { label: 'Tuần này',         value: s.maintenance_week,          sub: 'CT + Định kỳ',        color: 'bg-amber-50 text-amber-600',   icon: '📅', href: '/dashboard/calendar'    },
    { label: 'Chờ bảo hành',     value: s.warranty_tickets_pending,  sub: 'Yêu cầu chờ xử lý', color: 'bg-purple-50 text-purple-600', icon: '🛡️', href: '/dashboard/warranty'    },
  ]

  if (role === 'tech') return [
    { label: 'Bảo trì hôm nay', value: s.maintenance_today,              sub: 'CT + Định kỳ',       color: 'bg-orange-50 text-orange-600', icon: '🔧', href: '/dashboard/maintenance' },
    { label: 'Tuần này',         value: s.maintenance_week,               sub: 'CT + Định kỳ',       color: 'bg-amber-50 text-amber-600',   icon: '📅', href: '/dashboard/calendar'    },
    { label: 'Đang thi công',    value: s.construction_ongoing,           sub: 'Công trình',          color: 'bg-blue-50 text-blue-600',     icon: '🏗️', href: '/dashboard/maintenance' },
    { label: 'Chờ bảo hành',     value: s.warranty_tickets_pending,       sub: 'Yêu cầu chờ xử lý', color: 'bg-purple-50 text-purple-600', icon: '🛡️', href: '/dashboard/warranty'    },
  ]

  if (role === 'logistics') return [
    { label: 'Chờ giao',        value: s.logistics_pending,        sub: 'Chờ xác nhận + Chuẩn bị', color: 'bg-amber-50 text-amber-600',   icon: '📦', href: '/dashboard/contracts'   },
    { label: 'Quá hạn giao',    value: s.logistics_overdue,        sub: 'Chưa giao đúng hẹn',       color: 'bg-red-50 text-red-600',       icon: '⚠️', href: '/dashboard/contracts'   },
    { label: 'Bảo trì hôm nay', value: s.maintenance_today,        sub: 'CT + Định kỳ',             color: 'bg-orange-50 text-orange-600', icon: '🔧', href: '/dashboard/maintenance' },
    { label: 'Chờ bảo hành',    value: s.warranty_tickets_pending, sub: 'Yêu cầu chờ xử lý',       color: 'bg-purple-50 text-purple-600', icon: '🛡️', href: '/dashboard/warranty'    },
  ]

  return [
    { label: 'Khách hàng', value: s.total_customers, sub: `+${s.new_customers_month} tháng`, color: 'bg-blue-50 text-blue-600',   icon: '👥', href: '/dashboard/customers' },
    { label: 'Báo giá chờ', value: s.pending_quotes, sub: 'Nháp + Đã gửi',                   color: 'bg-amber-50 text-amber-600', icon: '📋', href: '/dashboard/contracts'  },
  ]
}

function buildWarRoom(role: string, s: DashboardStats): AlertItem[] {
  const items: AlertItem[] = []
  const isMgr = ['admin', 'ceo', 'director'].includes(role)
  const isKH  = ['admin', 'ceo', 'director', 'sales', 'partner'].includes(role)
  const isTechMaint = ['admin', 'ceo', 'director', 'tech_lead', 'tech', 'logistics'].includes(role)

  // ── 🔴 Khẩn cấp ──
  if (s.cong_no_qua_han > 0 && (isMgr || role === 'accountant'))
    items.push({ label: 'Công nợ quá hạn', count: s.cong_no_qua_han, valueStr: fmtMoney(s.cong_no_qua_han) + 'đ', href: '/dashboard/finance', severity: 'urgent' })
  if (s.kh_no_contact_30d > 0 && isKH)
    items.push({ label: 'KH chưa liên hệ > 30 ngày', count: s.kh_no_contact_30d, href: '/dashboard/customers', severity: 'urgent' })
  if (s.maintenance_overdue > 0 && isTechMaint)
    items.push({ label: 'Bảo trì định kỳ quá hạn', count: s.maintenance_overdue, href: '/dashboard/maintenance', severity: 'urgent' })

  // ── 🟠 Quan trọng ──
  if (s.warranty_tickets_pending > 0 && isTechMaint)
    items.push({ label: 'Bảo hành chờ xử lý', count: s.warranty_tickets_pending, href: '/dashboard/warranty', severity: 'important' })
  if (s.logistics_overdue > 0 && (role === 'logistics' || isMgr))
    items.push({ label: 'Đơn giao quá hạn', count: s.logistics_overdue, href: '/dashboard/contracts', severity: 'important' })
  if (s.quotes_cho_duyet > 0 && isMgr)
    items.push({ label: 'Báo giá chờ duyệt', count: s.quotes_cho_duyet, href: '/dashboard/contracts', severity: 'important' })

  // ── 🟡 Theo dõi ──
  if (s.quotes_stale > 0 && (['sales', 'partner'].includes(role) || isMgr))
    items.push({ label: 'Báo giá đã gửi chưa phản hồi', count: s.quotes_stale, href: '/dashboard/contracts', severity: 'watch' })
  if (s.contracts_unpaid > 0 && (role === 'accountant' || isMgr))
    items.push({ label: 'Hợp đồng chưa thu đủ', count: s.contracts_unpaid, href: '/dashboard/contracts', severity: 'watch' })
  if (s.hoa_hong_chua_tra > 0 && isMgr)
    items.push({ label: 'Hoa hồng chưa trả', count: s.hoa_hong_chua_tra, valueStr: fmtMoney(s.hoa_hong_chua_tra) + 'đ', href: '/dashboard/finance', severity: 'watch' })

  return items
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

  const role          = profile?.role ?? 'sales'
  const cards         = stats ? buildCards(role, stats, profile?.target_thang ?? null) : []
  const warRoomAlerts = stats ? buildWarRoom(role, stats) : []
  const isManager     = ['admin', 'ceo', 'director'].includes(role)
  const showRevChart  = ['admin', 'ceo', 'director', 'accountant', 'sales'].includes(role)
  const showPipeline  = ['admin', 'ceo', 'director', 'accountant', 'sales', 'partner'].includes(role)
  const showFunnel    = isManager || role === 'sales' || role === 'partner'

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

      {/* ── War Room ── */}
      <WarRoom alerts={warRoomAlerts} loading={loading} />

      {/* ── Quick actions ── */}
      <QuickActions role={role} />

      {/* ── Lịch hôm nay ── */}
      <MiniCalendar />

      {/* ── Việc cần làm (tech/logistics/sales) ── */}
      <MyTasksWidget role={role} />

      {/* ── KPI cards ── */}
      {cards.length > 0 && <KPIGrid cards={cards} loading={false} />}

      {/* ── P&L widget (manager only) ── */}
      {isManager && stats?.pl_summary && <PLWidget pl={stats.pl_summary} />}

      {/* ── Revenue chart ── */}
      {showRevChart && stats && stats.revenue_6months.some(m => m.value > 0) && (
        <RevenueChart data={stats.revenue_6months} />
      )}

      {/* ── Pipeline ── */}
      {showPipeline && stats && <PipelineSection pipeline={stats.pipeline} />}

      {/* ── Conversion Funnel ── */}
      {showFunnel && stats && <ConversionFunnel pipeline={stats.pipeline} />}

      {/* ── Activity feed (manager only) ── */}
      {isManager && stats && stats.activity_feed.length > 0 && (
        <ActivityFeed feed={stats.activity_feed} />
      )}

    </div>
  )
}
