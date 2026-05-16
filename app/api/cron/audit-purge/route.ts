import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Vercel Cron — chạy mùng 1 hàng tháng lúc 02:00 UTC
// GET /api/cron/audit-purge
// DELETE audit_logs WHERE created_at < NOW() - INTERVAL 'N days'
// N lấy từ company_settings.audit_retention_days (default 365)

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const svc = createServiceClient()

    // Lấy retention period từ company_settings
    const { data: settings } = await svc
      .from('company_settings')
      .select('audit_retention_days')
      .single()

    const retentionDays = (settings as { audit_retention_days?: number } | null)?.audit_retention_days ?? 365
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

    const { error, count } = await svc
      .from('audit_logs')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)

    if (error) throw error

    // Ghi lại cron log vào audit_logs
    await svc.from('audit_logs').insert({
      user_id:   '00000000-0000-0000-0000-000000000000',
      user_name: 'System Cron',
      action:    'settings_updated',
      entity:    'system_config',
      detail:    `cron_audit_purge: xoá ${count ?? 0} bản ghi nhật ký cũ hơn ${retentionDays} ngày`,
    })

    return NextResponse.json({ success: true, deleted: count ?? 0, retention_days: retentionDays })
  } catch (err) {
    console.error('GET /api/cron/audit-purge:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
