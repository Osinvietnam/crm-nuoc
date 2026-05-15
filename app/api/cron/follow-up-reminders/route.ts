import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Vercel Cron — chạy mỗi ngày lúc 8:00 ICT (01:00 UTC)
// GET /api/cron/follow-up-reminders
//
// Logic: scan customers ở các stage "nóng" mà không có hoạt động trong X ngày
// → tạo notification cho nguoi_phu_trach của từng KH

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
    const supabase = createServiceClient()
    const todayStr = new Date().toISOString().split('T')[0]
    let totalNotified = 0

    for (const [stage, days] of Object.entries(STAGE_THRESHOLDS)) {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()

      // Lấy KH ở stage này chưa được cập nhật trong `days` ngày
      const { data: overdue, error } = await supabase
        .from('customers')
        .select('id, ho_ten, nguoi_phu_trach')
        .eq('pipeline', stage)
        .lt('updated_at', cutoff)
        .not('nguoi_phu_trach', 'is', null)

      if (error) {
        console.error(`follow-up-reminders [${stage}]:`, error.message)
        continue
      }

      if (!overdue?.length) continue

      for (const kh of overdue) {
        // Tránh gửi trùng: check đã có reminder cho KH này hôm nay chưa
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
          body:    `KH đang ở giai đoạn "${stage}" nhưng chưa được cập nhật ${days} ngày. Hãy liên hệ sớm!`,
          link:    `/dashboard/customers/${kh.id}`,
        })

        totalNotified++
      }
    }

    console.log(`[cron/follow-up-reminders] ${new Date().toISOString()} — notified ${totalNotified} KH`)
    return NextResponse.json({ notified: totalNotified, date: todayStr })
  } catch (err) {
    console.error('cron/follow-up-reminders:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
