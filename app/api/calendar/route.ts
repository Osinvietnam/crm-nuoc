import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface CalendarEvent {
  id:    string
  date:  number        // ms timestamp — dùng để nhóm theo ngày
  type:  'quote' | 'construction' | 'periodic' | 'contract' | 'project'
  color: string        // tailwind bg class
  title: string        // tên KH / tên dự án
  sub:   string        // mô tả ngắn
  href:  string        // deep link
}

// ms → 'YYYY-MM-DD' cho Supabase DATE filter
function toDateStr(ms: number): string {
  return new Date(ms).toISOString().split('T')[0]
}

// 'YYYY-MM-DD' → ms (start of day UTC)
function toMs(d: string | null): number | null {
  if (!d) return null
  const ms = new Date(d).getTime()
  return isNaN(ms) ? null : ms
}

function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const { role } = profile

    // ── Parse tháng ─────────────────────────────────────────────────────────────
    const monthParam = req.nextUrl.searchParams.get('month')
    let rangeStart: number, rangeEnd: number
    if (monthParam) {
      const [y, m] = monthParam.split('-').map(Number)
      rangeStart = new Date(y, m - 1, 1).getTime()
      rangeEnd   = new Date(y, m, 1).getTime() - 1
    } else {
      const now = new Date()
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      rangeEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1
    }
    const dateFrom = toDateStr(rangeStart)
    const dateTo   = toDateStr(rangeEnd)

    const events: CalendarEvent[] = []

    const isAdmin   = ['admin', 'ceo', 'tech_lead', 'accountant'].includes(role)
    const isTech    = role === 'tech'
    const isSales   = ['sales', 'logistics', 'partner'].includes(role)

    // ── 1. Báo giá — ngày follow-up ────────────────────────────────────────────
    if (isAdmin || isSales) {
      let q = supabase
        .from('quotes')
        .select('id, trang_thai, ngay_follow_up, staff:nguoi_phu_trach(full_name), customers!customer_id(ho_ten)')
        .in('trang_thai', ['Đã gửi', 'Đàm phán'])
        .gte('ngay_follow_up', dateFrom)
        .lte('ngay_follow_up', dateTo)

      if (!isAdmin) q = q.eq('nguoi_phu_trach', user.id)

      const { data: quotes } = await q
      for (const r of (quotes ?? [])) {
        const ms = toMs((r as any).ngay_follow_up)
        if (!ms) continue
        events.push({
          id:    r.id.toString(),
          date:  startOfDay(ms),
          type:  'quote',
          color: 'bg-blue-500',
          title: (r as any).customers?.ho_ten ?? '',
          sub:   `Follow-up BG · ${r.trang_thai}`,
          href:  `/dashboard/orders/quote/${r.id}`,
        })
      }
    }

    // ── 2. Bảo trì công trình — ngày cần chăm sóc (GENERATED column) ──────────
    if (isAdmin || isTech) {
      let q = supabase
        .from('maintenance_construction')
        .select('id, trang_thai, ngay_can_cs, ktv:ktv_phu_trach(full_name), customers!customer_id(ho_ten, dia_chi)')
        .gte('ngay_can_cs', dateFrom)
        .lte('ngay_can_cs', dateTo)

      if (isTech) q = q.eq('ktv_phu_trach', user.id)

      const { data: constructions } = await q
      for (const r of (constructions ?? [])) {
        const ms = toMs((r as any).ngay_can_cs)
        if (!ms) continue
        const ten = (r as any).customers?.ho_ten ?? (r as any).customers?.dia_chi ?? ''
        events.push({
          id:    r.id.toString(),
          date:  startOfDay(ms),
          type:  'construction',
          color: 'bg-orange-500',
          title: ten,
          sub:   'Chăm sóc công trình',
          href:  `/dashboard/maintenance/construction/${r.id}`,
        })
      }
    }

    // ── 3. Bảo dưỡng định kỳ — lần bảo dưỡng tiếp theo ──────────────────────
    if (isAdmin || isTech) {
      let q = supabase
        .from('maintenance_periodic')
        .select('id, trang_thai, lan_bd_tiep_theo, staff:nv_phu_trach(full_name), customers!customer_id(ho_ten)')
        .gte('lan_bd_tiep_theo', dateFrom)
        .lte('lan_bd_tiep_theo', dateTo)

      if (isTech) q = q.eq('nv_phu_trach', user.id)

      const { data: periodics } = await q
      for (const r of (periodics ?? [])) {
        const ms = toMs((r as any).lan_bd_tiep_theo)
        if (!ms) continue
        events.push({
          id:    r.id.toString(),
          date:  startOfDay(ms),
          type:  'periodic',
          color: 'bg-purple-500',
          title: (r as any).customers?.ho_ten ?? '',
          sub:   'Bảo dưỡng định kỳ',
          href:  `/dashboard/maintenance/periodic/${r.id}`,
        })
      }
    }

    // ── 4. Hợp đồng B2C — ngày giao hàng dự kiến ─────────────────────────────
    if (isAdmin || isSales) {
      let q = supabase
        .from('orders')
        .select('id, trang_thai, ngay_giao_dk, staff:nguoi_phu_trach(full_name), customers!customer_id(ho_ten)')
        .eq('type', 'b2c')
        .not('trang_thai', 'in', '("Hoàn thành","Hủy hợp đồng")')
        .gte('ngay_giao_dk', dateFrom)
        .lte('ngay_giao_dk', dateTo)

      if (!isAdmin) q = q.eq('nguoi_phu_trach', user.id)

      const { data: contracts } = await q
      for (const r of (contracts ?? [])) {
        const ms = toMs((r as any).ngay_giao_dk)
        if (!ms) continue
        events.push({
          id:    r.id.toString(),
          date:  startOfDay(ms),
          type:  'contract',
          color: 'bg-green-500',
          title: (r as any).customers?.ho_ten ?? '',
          sub:   `Giao hàng DK · ${r.trang_thai}`,
          href:  `/dashboard/orders/contract/${r.id}`,
        })
      }
    }

    // ── 5. Dự án — ngày ký hợp đồng ──────────────────────────────────────────
    if (isAdmin) {
      const { data: projects } = await supabase
        .from('orders')
        .select('id, trang_thai, ngay_ky, ten_du_an')
        .eq('type', 'project')
        .not('trang_thai', 'in', '("Hoàn thành","Thua thầu")')
        .gte('ngay_ky', dateFrom)
        .lte('ngay_ky', dateTo)

      for (const r of (projects ?? [])) {
        const ms = toMs((r as any).ngay_ky)
        if (!ms) continue
        events.push({
          id:    r.id.toString(),
          date:  startOfDay(ms),
          type:  'project',
          color: 'bg-teal-500',
          title: (r as any).ten_du_an ?? '',
          sub:   `Dự án · ${r.trang_thai}`,
          href:  `/dashboard/orders/project/${r.id}`,
        })
      }
    }

    events.sort((a, b) => a.date - b.date)

    return NextResponse.json({ events, role })
  } catch (err) {
    console.error('GET /api/calendar:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
