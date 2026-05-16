import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/admin/activity?month=5&year=2026 ────────────────────────────────
// Phân tích hoạt động nhân viên: audit_logs (P1) + user_sessions (P2) + online now
// Auth: admin | ceo | director

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const sp    = req.nextUrl.searchParams
    const now   = new Date()
    const month = Number(sp.get('month') ?? now.getMonth() + 1)
    const year  = Number(sp.get('year')  ?? now.getFullYear())

    // Khoảng thời gian của tháng được chọn
    const from = new Date(year, month - 1, 1).toISOString()
    const to   = new Date(year, month, 0, 23, 59, 59).toISOString()

    const svc = createServiceClient()

    // ── Query 1: audit_logs trong kỳ (tối đa 10000 rows) ─────────────────────
    const { data: logs, count: logCount } = await svc
      .from('audit_logs')
      .select('user_id, user_name, action, created_at', { count: 'exact' })
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true })
      .range(0, 9999)

    // ── Query 2: user_sessions trong kỳ ─────────────────────────────────────
    const { data: sessions } = await svc
      .from('user_sessions')
      .select('user_id, user_name, role, started_at, ended_at, last_ping_at, duration_min')
      .gte('started_at', from)
      .lte('started_at', to)

    // ── Query 3: Online ngay bây giờ (ping < 10 phút trước) ──────────────────
    const onlineCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: online } = await svc
      .from('user_sessions')
      .select('user_id, user_name, role, last_ping_at')
      .is('ended_at', null)
      .gte('last_ping_at', onlineCutoff)
      .order('last_ping_at', { ascending: false })

    // ── Aggregate audit_logs per user ────────────────────────────────────────
    type UserStats = {
      user_id: string
      user_name: string
      role: string
      total_actions: number
      active_days: Set<string>
      last_active_at: string | null
      action_breakdown: Record<string, number>
      // P2
      total_sessions: number
      total_online_min: number
    }

    const userMap = new Map<string, UserStats>()

    for (const log of logs ?? []) {
      if (!log.user_id) continue
      if (!userMap.has(log.user_id)) {
        userMap.set(log.user_id, {
          user_id:          log.user_id,
          user_name:        log.user_name ?? '',
          role:             '',
          total_actions:    0,
          active_days:      new Set(),
          last_active_at:   null,
          action_breakdown: {},
          total_sessions:   0,
          total_online_min: 0,
        })
      }
      const u = userMap.get(log.user_id)!
      u.total_actions++
      u.active_days.add(log.created_at.slice(0, 10))
      if (!u.last_active_at || log.created_at > u.last_active_at) {
        u.last_active_at = log.created_at
      }
      u.action_breakdown[log.action] = (u.action_breakdown[log.action] ?? 0) + 1
    }

    // ── Aggregate user_sessions per user ──────────────────────────────────────
    for (const s of sessions ?? []) {
      if (!s.user_id) continue
      if (!userMap.has(s.user_id)) {
        userMap.set(s.user_id, {
          user_id:          s.user_id,
          user_name:        s.user_name ?? '',
          role:             s.role      ?? '',
          total_actions:    0,
          active_days:      new Set(),
          last_active_at:   null,
          action_breakdown: {},
          total_sessions:   0,
          total_online_min: 0,
        })
      }
      const u = userMap.get(s.user_id)!
      if (!u.role && s.role) u.role = s.role
      u.total_sessions++
      u.total_online_min += s.duration_min ?? 0
    }

    // ── Build response users array ────────────────────────────────────────────
    const workingDays = countWorkingDays(year, month)
    const users = Array.from(userMap.values()).map(u => ({
      user_id:           u.user_id,
      user_name:         u.user_name,
      role:              u.role,
      total_actions:     u.total_actions,
      active_days:       u.active_days.size,
      working_days:      workingDays,
      last_active_at:    u.last_active_at,
      action_breakdown:  u.action_breakdown,
      avg_actions_per_active_day: u.active_days.size > 0
        ? Math.round(u.total_actions / u.active_days.size)
        : 0,
      total_sessions:    u.total_sessions,
      total_online_min:  u.total_online_min,
      avg_session_min:   u.total_sessions > 0
        ? Math.round(u.total_online_min / u.total_sessions)
        : 0,
      avg_online_min_per_active_day: u.active_days.size > 0
        ? Math.round(u.total_online_min / u.active_days.size)
        : 0,
    })).sort((a, b) => b.total_actions - a.total_actions)

    // ── Heatmap: đếm action theo (weekday × hour) ────────────────────────────
    // weekday: 0=Monday … 6=Sunday, hour: 0–23
    const heatmapMap = new Map<string, number>()
    for (const log of logs ?? []) {
      const d = new Date(log.created_at)
      // getDay(): 0=Sun, 1=Mon…6=Sat → chuyển sang 0=Mon…6=Sun
      const weekday = (d.getDay() + 6) % 7
      const hour    = d.getHours()
      const key     = `${weekday}-${hour}`
      heatmapMap.set(key, (heatmapMap.get(key) ?? 0) + 1)
    }
    const heatmap = Array.from(heatmapMap.entries()).map(([key, count]) => {
      const [weekday, hour] = key.split('-').map(Number)
      return { weekday, hour, count }
    })

    return NextResponse.json({
      users,
      heatmap,
      online: online ?? [],
      period: { month, year },
      working_days: workingDays,
      warning: (logCount ?? 0) > 10000
        ? `Dữ liệu bị cắt tại 10.000 rows (tổng: ${logCount}). Liên hệ admin để nâng giới hạn.`
        : null,
    })
  } catch (err) {
    console.error('GET /api/admin/activity:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ── Helper: đếm ngày làm việc (T2–T6) trong tháng ───────────────────────────
function countWorkingDays(year: number, month: number): number {
  let count = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay()
    if (day !== 0 && day !== 6) count++ // bỏ CN (0) và T7 (6)
  }
  return count
}
