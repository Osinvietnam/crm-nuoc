import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Vercel Cron — chạy mỗi ngày lúc 08:00 ICT (01:00 UTC)
// GET /api/cron/follow-up-reminders

const STAGE_THRESHOLDS: Record<string, number> = {
  'Tiềm năng': 14,
  'Báo giá':    7,
  'Đàm phán':   5,
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase    = createServiceClient()
    const todayStr    = new Date().toISOString().split('T')[0]
    let totalNotified = 0

    // ── 1. Follow-up reminders (M1: dùng customer_activities để verify) ────────
    for (const [stage, days] of Object.entries(STAGE_THRESHOLDS)) {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()

      const { data: candidates } = await supabase
        .from('customers')
        .select('id, ho_ten, nguoi_phu_trach, updated_at')
        .eq('pipeline', stage)
        .lt('updated_at', cutoff)
        .not('nguoi_phu_trach', 'is', null)

      for (const kh of candidates ?? []) {
        // M1: Verify bằng customer_activities — bỏ qua nếu có hoạt động gần đây
        const { data: recentActivity } = await supabase
          .from('customer_activities')
          .select('id')
          .eq('customer_id', kh.id)
          .gte('created_at', cutoff)
          .limit(1)
          .maybeSingle()

        if (recentActivity) continue  // Có hoạt động thực tế → bỏ qua

        // Dedup: 1 reminder/KH/ngày
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', kh.nguoi_phu_trach)
          .eq('type', 'follow_up_reminder')
          .like('link', `%/customers/${kh.id}%`)
          .gte('created_at', `${todayStr}T00:00:00Z`)
          .maybeSingle()

        if (existing) continue

        await supabase.from('notifications').insert({
          user_id: kh.nguoi_phu_trach,
          type:    'follow_up_reminder',
          title:   `Nhắc nhở: Liên hệ ${kh.ho_ten}`,
          body:    `KH đang ở giai đoạn "${stage}" chưa có hoạt động ${days} ngày. Hãy liên hệ sớm!`,
          link:    `/dashboard/customers/${kh.id}`,
        })
        totalNotified++
      }
    }

    // ── 2. Sprint 3: Thanh toán quá hạn → notify kế toán ─────────────────────
    const { data: overduePayments } = await supabase
      .from('payment_records')
      .select('id, order_id, so_tien, han_thanh_toan, orders(ma_hd, customer_id, customers(ho_ten))')
      .eq('da_thanh_toan', false)
      .lt('han_thanh_toan', todayStr)
      .not('han_thanh_toan', 'is', null)
      .limit(50)

    const { data: accountants } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['accountant', 'admin', 'ceo'])
      .eq('is_active', true)

    for (const pmt of overduePayments ?? []) {
      const order = (pmt as any).orders
      const khName = order?.customers?.ho_ten ?? `Đơn #${pmt.order_id}`
      const maHd   = order?.ma_hd ?? `#${pmt.order_id}`

      for (const acc of accountants ?? []) {
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', acc.id)
          .eq('type', 'payment_overdue')
          .like('link', `%${pmt.order_id}%`)
          .gte('created_at', `${todayStr}T00:00:00Z`)
          .maybeSingle()

        if (existingNotif) continue

        await supabase.from('notifications').insert({
          user_id: acc.id,
          type:    'payment_overdue',
          title:   'Thanh toán quá hạn',
          body:    `HĐ ${maHd} — ${khName}: đợt thanh toán đã quá hạn`,
          link:    `/dashboard/contracts/b2c/${pmt.order_id}`,
        })
        totalNotified++
      }
    }

    // ── 3. Sprint 3: Bảo trì định kỳ đến hạn trong 7 ngày → notify tech ──────
    const in7Days = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0]

    const { data: dueMaintenance } = await supabase
      .from('maintenance_periodic')
      .select('id, nv_phu_trach, customers(ho_ten), lan_bd_tiep_theo')
      .eq('trang_thai', 'Đang hoạt động')
      .lte('lan_bd_tiep_theo', in7Days)
      .gte('lan_bd_tiep_theo', todayStr)
      .not('nv_phu_trach', 'is', null)
      .limit(50)

    for (const maint of dueMaintenance ?? []) {
      const khName = (maint as any).customers?.ho_ten ?? 'KH không rõ'

      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', maint.nv_phu_trach)
        .eq('type', 'maintenance_due')
        .like('link', `%${maint.id}%`)
        .gte('created_at', `${todayStr}T00:00:00Z`)
        .maybeSingle()

      if (existingNotif) continue

      await supabase.from('notifications').insert({
        user_id: maint.nv_phu_trach,
        type:    'maintenance_due',
        title:   'Bảo trì đến hạn',
        body:    `${khName}: lịch bảo dưỡng định kỳ đến hạn vào ${maint.lan_bd_tiep_theo}`,
        link:    `/dashboard/maintenance/periodic/${maint.id}`,
      })
      totalNotified++
    }

    console.log(`[cron/follow-up-reminders] ${todayStr} — notified: ${totalNotified}`)
    return NextResponse.json({ notified: totalNotified, date: todayStr })
  } catch (err) {
    console.error('cron/follow-up-reminders:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
