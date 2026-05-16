import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/admin/system/health — System health snapshot ───────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const svc = createServiceClient()
    const t0  = Date.now()

    // Record counts (parallel)
    const [
      customersRes, ordersRes, quotesRes, paymentsRes, auditRes, usersRes,
    ] = await Promise.all([
      svc.from('customers').select('id', { count: 'exact', head: true }),
      svc.from('orders').select('id', { count: 'exact', head: true }),
      svc.from('quotes').select('id', { count: 'exact', head: true }),
      svc.from('payment_records').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      svc.from('audit_logs').select('id', { count: 'exact', head: true }),
      svc.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])

    const dbMs = Date.now() - t0

    // Last cron runs from audit_logs
    const { data: cronLogs } = await svc
      .from('audit_logs')
      .select('detail, created_at')
      .ilike('detail', 'cron_%')
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      counts: {
        customers:       customersRes.count ?? 0,
        orders:          ordersRes.count    ?? 0,
        quotes:          quotesRes.count    ?? 0,
        payment_records: paymentsRes.count  ?? 0,
        audit_logs:      auditRes.count     ?? 0,
        active_users:    usersRes.count     ?? 0,
      },
      db_response_ms: dbMs,
      last_cron_runs: cronLogs ?? [],
      checked_at:     new Date().toISOString(),
    })
  } catch (err) {
    console.error('GET /api/admin/system/health:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
