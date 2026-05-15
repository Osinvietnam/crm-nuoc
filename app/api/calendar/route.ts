import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface CalendarEvent {
  id:    string
  date:  number        // ms timestamp — dùng để nhóm theo ngày
  type:  // ── Báo giá ──────────────────────────────────────────────────────────
         | 'quote'          // BG follow-up
         | 'quote_expire'   // BG hết hạn
         | 'quote_submit'   // Nộp thầu (project quote)
         // ── Hợp đồng / giao hàng ─────────────────────────────────────────────
         | 'contract'       // Giao hàng B2C (dự kiến)
         | 'contract_sign'  // Ký HĐ tất cả loại
         | 'delivery_tm'    // Giao hàng TM (commercial)
         // ── Bảo trì ───────────────────────────────────────────────────────────
         | 'construction'   // Bảo trì công trình (ngay_can_cs)
         | 'acceptance'     // Nghiệm thu CT (ngay_nt)
         | 'periodic'       // Bảo dưỡng định kỳ
         // ── Bảo hành ──────────────────────────────────────────────────────────
         | 'warranty'       // Warranty ticket lên lịch
         // ── Dự án ─────────────────────────────────────────────────────────────
         | 'project'        // Dự án ký HĐ (cũ — giữ lại để compat)
         | 'project_sign'   // Ký HĐ dự án
         | 'project_start'  // Khởi công (ngay_bt_tc)
         | 'project_end'    // Dự kiến hoàn thành (ngay_hoan_thanh)
         // ── Tài vụ / Kế toán ─────────────────────────────────────────────────
         | 'payment_due'    // Đợt TT đến hạn (chưa TT)
         // ── Task ─────────────────────────────────────────────────────────────
         | 'task_due'       // Task được giao có due_date
  color: string        // tailwind bg class
  title: string        // tên KH / tên dự án / tiêu đề
  sub:   string        // mô tả ngắn
  href:  string        // deep link
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(ms: number): string {
  return new Date(ms).toISOString().split('T')[0]
}

function toMs(d: string | null | undefined): number | null {
  if (!d) return null
  const ms = new Date(d).getTime()
  return isNaN(ms) ? null : ms
}

function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// ─── GET /api/calendar?month=YYYY-MM ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const { role } = profile

    // ── Tháng cần lấy ─────────────────────────────────────────────────────────
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

    // ── Role flags ────────────────────────────────────────────────────────────
    const isAdmin      = ['admin', 'ceo'].includes(role)
    const isDirector   = ['admin', 'ceo', 'director'].includes(role)
    const isTechLead   = ['admin', 'ceo', 'director', 'tech_lead'].includes(role)
    const isTech       = role === 'tech'
    const isSales      = ['sales', 'partner'].includes(role)
    const isLogistics  = role === 'logistics'
    const isAccounting = ['accountant', 'admin', 'ceo'].includes(role)

    // Nhóm "quản lý hoặc liên quan giao hàng"
    const canSeeDelivery = isDirector || isLogistics || isAccounting
    // Nhóm Sales + quản lý
    const canSeeSales    = isSales || isDirector

    // ─────────────────────────────────────────────────────────────────────────
    // Q1 — BG follow-up (đang xử lý)
    // ─────────────────────────────────────────────────────────────────────────
    if (canSeeSales || isLogistics) {
      let q = supabase
        .from('quotes')
        .select('id, type, trang_thai, ngay_follow_up, customers!customer_id(ho_ten)')
        .in('trang_thai', ['Đã gửi', 'Đàm phán'])
        .gte('ngay_follow_up', dateFrom)
        .lte('ngay_follow_up', dateTo)

      if (isSales) q = q.eq('nguoi_phu_trach', user.id)

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs(r.ngay_follow_up)
        if (!ms) continue
        events.push({
          id:    `q-fu-${r.id}`,
          date:  startOfDay(ms),
          type:  'quote',
          color: 'bg-blue-500',
          title: (r as any).customers?.ho_ten ?? '',
          sub:   `Follow-up BG · ${r.trang_thai}`,
          href:  `/dashboard/quotes/${r.id}`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q2 — Bảo trì công trình (ngay_can_cs = giao hàng + 60 ngày)
    // ─────────────────────────────────────────────────────────────────────────
    if (isTechLead || isTech) {
      let q = supabase
        .from('maintenance_construction')
        .select('id, trang_thai, ngay_can_cs, customers!customer_id(ho_ten, dia_chi)')
        .gte('ngay_can_cs', dateFrom)
        .lte('ngay_can_cs', dateTo)

      if (isTech) q = q.eq('ktv_phu_trach', user.id)

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs((r as any).ngay_can_cs)
        if (!ms) continue
        const ten = (r as any).customers?.ho_ten ?? (r as any).customers?.dia_chi ?? ''
        events.push({
          id:    `mc-${r.id}`,
          date:  startOfDay(ms),
          type:  'construction',
          color: 'bg-orange-500',
          title: ten,
          sub:   'Chăm sóc công trình',
          href:  `/dashboard/maintenance/construction/${r.id}`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q3 — Bảo dưỡng định kỳ (lần tiếp theo)
    // ─────────────────────────────────────────────────────────────────────────
    if (isTechLead || isTech) {
      let q = supabase
        .from('maintenance_periodic')
        .select('id, trang_thai, lan_bd_tiep_theo, customers!customer_id(ho_ten)')
        .gte('lan_bd_tiep_theo', dateFrom)
        .lte('lan_bd_tiep_theo', dateTo)

      if (isTech) q = q.eq('nv_phu_trach', user.id)

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs((r as any).lan_bd_tiep_theo)
        if (!ms) continue
        events.push({
          id:    `mp-${r.id}`,
          date:  startOfDay(ms),
          type:  'periodic',
          color: 'bg-purple-500',
          title: (r as any).customers?.ho_ten ?? '',
          sub:   'Bảo dưỡng định kỳ',
          href:  `/dashboard/maintenance/periodic/${r.id}`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q4 — Giao hàng B2C dự kiến
    // ─────────────────────────────────────────────────────────────────────────
    if (canSeeSales || isLogistics || isAccounting) {
      let q = supabase
        .from('orders')
        .select('id, trang_thai, ngay_giao_dk, customers!customer_id(ho_ten)')
        .eq('type', 'b2c')
        .not('trang_thai', 'in', '("Hoàn thành","Hủy hợp đồng")')
        .gte('ngay_giao_dk', dateFrom)
        .lte('ngay_giao_dk', dateTo)

      if (isSales) q = q.eq('nguoi_phu_trach', user.id)

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs((r as any).ngay_giao_dk)
        if (!ms) continue
        events.push({
          id:    `ord-b2c-dk-${r.id}`,
          date:  startOfDay(ms),
          type:  'contract',
          color: 'bg-green-500',
          title: (r as any).customers?.ho_ten ?? '',
          sub:   `Giao hàng DK · ${r.trang_thai}`,
          href:  `/dashboard/contracts/${r.id}`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q5 — Ký HĐ dự án (legacy — giữ lại cho Admin, dùng ngay_ky)
    // ─────────────────────────────────────────────────────────────────────────
    // Replaced by Q8 below; keeping stub to not break old event type
    // (Q8 covers all order types including project)

    // ─────────────────────────────────────────────────────────────────────────
    // Q6 — BG hết hạn
    // ─────────────────────────────────────────────────────────────────────────
    if (canSeeSales) {
      let q = supabase
        .from('quotes')
        .select('id, type, trang_thai, ngay_het_han, customers!customer_id(ho_ten)')
        .not('trang_thai', 'in', '("Đã ký HĐ","Từ chối","Đã hủy","Tạo HĐ")')
        .not('ngay_het_han', 'is', null)
        .gte('ngay_het_han', dateFrom)
        .lte('ngay_het_han', dateTo)

      if (isSales) q = q.eq('nguoi_phu_trach', user.id)

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs((r as any).ngay_het_han)
        if (!ms) continue
        events.push({
          id:    `q-exp-${r.id}`,
          date:  startOfDay(ms),
          type:  'quote_expire',
          color: 'bg-red-500',
          title: (r as any).customers?.ho_ten ?? '',
          sub:   `BG hết hạn · ${r.trang_thai}`,
          href:  `/dashboard/quotes/${r.id}`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q7 — Nộp thầu (quotes type=project, ngay_nop_thau)
    // ─────────────────────────────────────────────────────────────────────────
    if (canSeeSales) {
      let q = supabase
        .from('quotes')
        .select('id, trang_thai, ngay_nop_thau, ten_da, chu_dau_tu')
        .eq('type', 'project')
        .not('ngay_nop_thau', 'is', null)
        .gte('ngay_nop_thau', dateFrom)
        .lte('ngay_nop_thau', dateTo)

      if (isSales) q = q.eq('nguoi_phu_trach', user.id)

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs((r as any).ngay_nop_thau)
        if (!ms) continue
        events.push({
          id:    `q-sub-${r.id}`,
          date:  startOfDay(ms),
          type:  'quote_submit',
          color: 'bg-orange-400',
          title: (r as any).ten_da ?? (r as any).chu_dau_tu ?? '',
          sub:   `Nộp thầu · ${r.trang_thai}`,
          href:  `/dashboard/quotes/${r.id}`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q8 — Ký HĐ tất cả loại orders (ngay_ky)
    // ─────────────────────────────────────────────────────────────────────────
    if (canSeeSales || isLogistics || isAccounting) {
      let q = supabase
        .from('orders')
        .select('id, type, trang_thai, ngay_ky, customers!customer_id(ho_ten), ten_da')
        .not('ngay_ky', 'is', null)
        .gte('ngay_ky', dateFrom)
        .lte('ngay_ky', dateTo)

      if (isSales) q = q.eq('nguoi_phu_trach', user.id)

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs((r as any).ngay_ky)
        if (!ms) continue
        const title = (r as any).type === 'project'
          ? ((r as any).ten_da ?? '')
          : ((r as any).customers?.ho_ten ?? '')
        events.push({
          id:    `ord-sign-${r.id}`,
          date:  startOfDay(ms),
          type:  'contract_sign',
          color: 'bg-emerald-500',
          title,
          sub:   `Ký HĐ · ${(r as any).type === 'b2c' ? 'B2C' : (r as any).type === 'commercial' ? 'TM' : 'Dự án'}`,
          href:  `/dashboard/contracts/${r.id}`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q9 — Giao hàng thương mại (commercial, ngay_giao_dk)
    // ─────────────────────────────────────────────────────────────────────────
    if (canSeeSales || isLogistics || isAccounting) {
      let q = supabase
        .from('orders')
        .select('id, trang_thai, ngay_giao_dk, customers!customer_id(ho_ten), ten_kh_tm')
        .eq('type', 'commercial')
        .not('trang_thai', 'in', '("Đã thanh toán","Hủy")')
        .not('ngay_giao_dk', 'is', null)
        .gte('ngay_giao_dk', dateFrom)
        .lte('ngay_giao_dk', dateTo)

      if (isSales) q = q.eq('nguoi_phu_trach', user.id)

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs((r as any).ngay_giao_dk)
        if (!ms) continue
        const title = (r as any).customers?.ho_ten ?? (r as any).ten_kh_tm ?? ''
        events.push({
          id:    `ord-tm-${r.id}`,
          date:  startOfDay(ms),
          type:  'delivery_tm',
          color: 'bg-green-400',
          title,
          sub:   `Giao hàng TM · ${r.trang_thai}`,
          href:  `/dashboard/contracts/commercial/${r.id}`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q10 — Nghiệm thu công trình (ngay_nt)
    // ─────────────────────────────────────────────────────────────────────────
    if (isTechLead || isTech) {
      let q = supabase
        .from('maintenance_construction')
        .select('id, trang_thai, ngay_nt, customers!customer_id(ho_ten, dia_chi)')
        .not('ngay_nt', 'is', null)
        .gte('ngay_nt', dateFrom)
        .lte('ngay_nt', dateTo)

      if (isTech) q = q.eq('ktv_phu_trach', user.id)

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs((r as any).ngay_nt)
        if (!ms) continue
        const ten = (r as any).customers?.ho_ten ?? (r as any).customers?.dia_chi ?? ''
        events.push({
          id:    `mc-nt-${r.id}`,
          date:  startOfDay(ms),
          type:  'acceptance',
          color: 'bg-yellow-500',
          title: ten,
          sub:   'Nghiệm thu công trình',
          href:  `/dashboard/maintenance/construction/${r.id}`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q11 — Warranty ticket lên lịch (scheduled_date)
    // ─────────────────────────────────────────────────────────────────────────
    if (isTechLead || isTech) {
      let q = supabase
        .from('warranty_tickets')
        .select('id, title, trang_thai, scheduled_date, scheduled_note, customers(ho_ten)')
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', dateFrom)
        .lte('scheduled_date', dateTo)
        .not('trang_thai', 'in', '("Hoàn thành","Đóng")')

      if (isTech) q = q.eq('nguoi_xu_ly', user.id)

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs((r as any).scheduled_date)
        if (!ms) continue
        events.push({
          id:    `wt-${r.id}`,
          date:  startOfDay(ms),
          type:  'warranty',
          color: 'bg-red-400',
          title: (r as any).customers?.ho_ten ?? r.title ?? '',
          sub:   `${r.title} · ${(r as any).scheduled_note ?? r.trang_thai}`,
          href:  `/dashboard/warranty`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q12 — Task completions có due_date được giao cho user này
    // ─────────────────────────────────────────────────────────────────────────
    {
      let q = supabase
        .from('task_completions')
        .select('id, task_key, stage, status, due_date, assigned_to_name')
        .not('due_date', 'is', null)
        .not('status', 'eq', 'hoan_thanh')
        .gte('due_date', dateFrom)
        .lte('due_date', dateTo)

      // Admin/tech_lead/director thấy tất cả; còn lại thấy task của mình
      if (!isTechLead && !isDirector) {
        q = q.eq('assigned_to', user.id)
      }

      const { data } = await q
      for (const r of data ?? []) {
        const ms = toMs((r as any).due_date)
        if (!ms) continue
        events.push({
          id:    `task-${r.id}`,
          date:  startOfDay(ms),
          type:  'task_due',
          color: 'bg-gray-700',
          title: r.stage ?? r.task_key ?? 'Task',
          sub:   `📋 ${r.task_key} · ${(r as any).assigned_to_name ?? 'Chưa giao'}`,
          href:  `/dashboard/tasks`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q13 — Đợt thanh toán đến hạn (payment_records chưa TT)
    // ─────────────────────────────────────────────────────────────────────────
    if (isAccounting) {
      // Accountant: tất cả đợt TT đến hạn chưa thanh toán
      const { data } = await supabase
        .from('payment_records')
        .select('id, customer_name, installment, amount, due_date, order_id')
        .eq('is_paid', false)
        .not('due_date', 'is', null)
        .gte('due_date', dateFrom)
        .lte('due_date', dateTo)

      for (const r of data ?? []) {
        const ms = toMs((r as any).due_date)
        if (!ms) continue
        const pct = r.installment === 1 ? '60%' : r.installment === 2 ? '35%' : '5%'
        events.push({
          id:    `pay-${r.id}`,
          date:  startOfDay(ms),
          type:  'payment_due',
          color: 'bg-violet-500',
          title: r.customer_name ?? '',
          sub:   `Đợt ${r.installment} (${pct}) · Chưa TT`,
          href:  r.order_id ? `/dashboard/contracts/${r.order_id}` : `/dashboard/finance`,
        })
      }
    } else if (isSales) {
      // Sales: đợt TT của đơn mình (join qua order_id → nguoi_phu_trach)
      const { data } = await supabase
        .from('payment_records')
        .select('id, customer_name, installment, amount, due_date, order_id, orders!order_id(nguoi_phu_trach)')
        .eq('is_paid', false)
        .not('due_date', 'is', null)
        .not('order_id', 'is', null)
        .gte('due_date', dateFrom)
        .lte('due_date', dateTo)

      for (const r of data ?? []) {
        const orderPt = (r as any).orders?.nguoi_phu_trach
        if (orderPt !== user.id) continue
        const ms = toMs((r as any).due_date)
        if (!ms) continue
        const pct = r.installment === 1 ? '60%' : r.installment === 2 ? '35%' : '5%'
        events.push({
          id:    `pay-${r.id}`,
          date:  startOfDay(ms),
          type:  'payment_due',
          color: 'bg-violet-500',
          title: r.customer_name ?? '',
          sub:   `Đợt ${r.installment} (${pct}) · Chưa TT`,
          href:  r.order_id ? `/dashboard/contracts/${r.order_id}` : `/dashboard/finance`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Q14 — Milestones dự án (ngay_bt_tc, ngay_hoan_thanh, ngay_du_kien_ky)
    // ─────────────────────────────────────────────────────────────────────────
    if (isDirector || isLogistics) {
      const { data } = await supabase
        .from('orders')
        .select('id, trang_thai, ten_da, ngay_du_kien_ky, ngay_bt_tc, ngay_hoan_thanh')
        .eq('type', 'project')
        .not('trang_thai', 'in', '("Hoàn thành","Thua thầu")')

      for (const r of data ?? []) {
        // Ngày dự kiến ký
        const msKy = toMs((r as any).ngay_du_kien_ky)
        if (msKy) {
          const d = new Date(msKy)
          if (d >= new Date(dateFrom) && d <= new Date(dateTo)) {
            events.push({
              id:    `proj-sign-${r.id}`,
              date:  startOfDay(msKy),
              type:  'project_sign',
              color: 'bg-teal-500',
              title: (r as any).ten_da ?? '',
              sub:   `DK ký HĐ · ${r.trang_thai}`,
              href:  `/dashboard/contracts/project/${r.id}`,
            })
          }
        }

        // Khởi công
        const msBt = toMs((r as any).ngay_bt_tc)
        if (msBt) {
          const d = new Date(msBt)
          if (d >= new Date(dateFrom) && d <= new Date(dateTo)) {
            events.push({
              id:    `proj-start-${r.id}`,
              date:  startOfDay(msBt),
              type:  'project_start',
              color: 'bg-cyan-500',
              title: (r as any).ten_da ?? '',
              sub:   `Khởi công · ${r.trang_thai}`,
              href:  `/dashboard/contracts/project/${r.id}`,
            })
          }
        }

        // Hoàn thành
        const msHt = toMs((r as any).ngay_hoan_thanh)
        if (msHt) {
          const d = new Date(msHt)
          if (d >= new Date(dateFrom) && d <= new Date(dateTo)) {
            events.push({
              id:    `proj-end-${r.id}`,
              date:  startOfDay(msHt),
              type:  'project_end',
              color: 'bg-teal-600',
              title: (r as any).ten_da ?? '',
              sub:   `Dự kiến hoàn thành · ${r.trang_thai}`,
              href:  `/dashboard/contracts/project/${r.id}`,
            })
          }
        }
      }
    }

    events.sort((a, b) => a.date - b.date)

    return NextResponse.json({ events, role })
  } catch (err) {
    console.error('GET /api/calendar:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
