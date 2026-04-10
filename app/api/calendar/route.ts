export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listAllRecords } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'

export interface CalendarEvent {
  id:       string
  date:     number        // ms timestamp — dùng để nhóm theo ngày
  type:     'quote' | 'construction' | 'periodic' | 'contract' | 'project'
  color:    string        // tailwind bg class
  title:    string        // tên KH / tên dự án
  sub:      string        // mô tả ngắn
  href:     string        // deep link
}

function startOfDay(ms: number) {
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

    const { role, full_name } = profile

    // Parse month param: "2026-04"
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

    const events: CalendarEvent[] = []

    const isAdmin    = ['admin', 'ceo', 'tech_lead', 'accountant'].includes(role)
    const isTech     = role === 'tech'
    const isSales    = role === 'sales' || role === 'logistics'
    const isPartner  = role === 'partner'
    const myFilter   = (field: string) =>
      !isAdmin ? `CurrentValue.[${field}] = "${full_name}"` : undefined

    // ─── Báo giá — follow-up date ────────────────────────────────────────────
    if (isAdmin || isSales || isPartner) {
      const filter = myFilter('Người phụ trách')
      const records = await listAllRecords(TABLES.QUOTES, filter)
      for (const r of records) {
        const f = r.fields
        const fu = f['Ngày follow-up'] ? Number(f['Ngày follow-up']) : null
        const status = String(f['Trạng thái BG'] ?? '')
        if (!fu || fu < rangeStart || fu > rangeEnd) continue
        if (!['Đã gửi', 'Đàm phán'].includes(status)) continue
        events.push({
          id:    r.record_id,
          date:  startOfDay(fu),
          type:  'quote',
          color: 'bg-blue-500',
          title: String(f['Khách hàng'] ?? ''),
          sub:   `Follow-up BG · ${status}`,
          href:  `/dashboard/orders/quote/${r.record_id}`,
        })
      }
    }

    // ─── Bảo trì công trình — ngày cần chăm sóc ──────────────────────────────
    if (isAdmin || isTech) {
      const filter = isTech ? myFilter('KTV phụ trách') : undefined
      const records = await listAllRecords(TABLES.CONSTRUCTION, filter)
      for (const r of records) {
        const f = r.fields
        const gh = f['Ngày GH thực'] ? Number(f['Ngày GH thực']) : null
        if (!gh) continue
        const csDate = gh + 60 * 86400000   // +60 ngày
        if (csDate < rangeStart || csDate > rangeEnd) continue
        events.push({
          id:    r.record_id,
          date:  startOfDay(csDate),
          type:  'construction',
          color: 'bg-orange-500',
          title: String(f['Tên KH / Địa chỉ'] ?? String(f['Tên KH'] ?? '')),
          sub:   'Chăm sóc công trình',
          href:  `/dashboard/maintenance/construction/${r.record_id}`,
        })
      }
    }

    // ─── Bảo dưỡng định kỳ — lần bảo dưỡng tiếp theo ────────────────────────
    if (isAdmin || isTech) {
      const filter = isTech ? myFilter('NV phụ trách') : undefined
      const records = await listAllRecords(TABLES.PERIODIC_SERVICE, filter)
      for (const r of records) {
        const f = r.fields
        const next = f['Lần BD tiếp theo'] ? Number(f['Lần BD tiếp theo']) : null
        if (!next || next < rangeStart || next > rangeEnd) continue
        events.push({
          id:    r.record_id,
          date:  startOfDay(next),
          type:  'periodic',
          color: 'bg-purple-500',
          title: String(f['Tên KH'] ?? ''),
          sub:   'Bảo dưỡng định kỳ',
          href:  `/dashboard/maintenance/periodic/${r.record_id}`,
        })
      }
    }

    // ─── Hợp đồng — ngày giao hàng dự kiến ──────────────────────────────────
    if (isAdmin || isSales) {
      const filter = myFilter('Người phụ trách')
      const records = await listAllRecords(TABLES.CONTRACTS, filter)
      for (const r of records) {
        const f = r.fields
        const ngay = f['Ngày giao hàng DK'] ? Number(f['Ngày giao hàng DK']) : null
        if (!ngay || ngay < rangeStart || ngay > rangeEnd) continue
        const status = String(f['Trạng thái HĐ'] ?? '')
        if (['Hoàn thành', 'Hủy hợp đồng'].includes(status)) continue
        events.push({
          id:    r.record_id,
          date:  startOfDay(ngay),
          type:  'contract',
          color: 'bg-green-500',
          title: String(f['Khách hàng'] ?? ''),
          sub:   `Giao hàng DK · ${status}`,
          href:  `/dashboard/orders/contract/${r.record_id}`,
        })
      }
    }

    // ─── Dự án — deadline gần nhất ───────────────────────────────────────────
    if (isAdmin) {
      const records = await listAllRecords(TABLES.PROJECTS)
      for (const r of records) {
        const f = r.fields
        // Dùng ngày ký HĐ hoặc deadline nếu có
        const ngay = f['Ngày ký HĐ'] ? Number(f['Ngày ký HĐ']) : null
        if (!ngay || ngay < rangeStart || ngay > rangeEnd) continue
        const stage = String(f['Giai đoạn'] ?? '')
        if (['Hoàn thành', 'Thua thầu'].includes(stage)) continue
        events.push({
          id:    r.record_id,
          date:  startOfDay(ngay),
          type:  'project',
          color: 'bg-teal-500',
          title: String(f['Tên dự án'] ?? ''),
          sub:   `Dự án · ${stage}`,
          href:  `/dashboard/orders/project/${r.record_id}`,
        })
      }
    }

    // Sort by date
    events.sort((a, b) => a.date - b.date)

    return NextResponse.json({ events, role })
  } catch (err) {
    console.error('GET /api/calendar:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
