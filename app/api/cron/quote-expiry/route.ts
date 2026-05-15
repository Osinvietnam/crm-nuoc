import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Vercel Cron — chạy mỗi ngày lúc 09:00 ICT (02:00 UTC)
// GET /api/cron/quote-expiry
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const today    = new Date().toISOString().split('T')[0]

    // ── 1. Expire quá hạn ──────────────────────────────────────────────────────
    const { data: expired, error } = await supabase
      .from('quotes')
      .update({ trang_thai: 'Hết hạn' })
      .lt('ngay_het_han', today)
      .in('trang_thai', ['Nháp', 'Đã gửi', 'Đàm phán'])
      .select('id, ma_bao_gia, customer_id, nguoi_phu_trach')

    if (error) throw error

    // ── 2. H2: Rollback pipeline KH về "Tiềm năng" nếu không còn BG nào active ─
    const customerIds = [...new Set((expired ?? []).map(q => q.customer_id).filter(Boolean))]
    let pipelineRolledBack = 0

    for (const cid of customerIds) {
      const { data: activeQuotes } = await supabase
        .from('quotes')
        .select('id')
        .eq('customer_id', cid)
        .not('trang_thai', 'in', '("Hết hạn","Từ chối","Thua thầu","Chấp nhận","Xác nhận","Thắng thầu")')
        .limit(1)

      if (!activeQuotes?.length) {
        const { error: rollbackErr } = await supabase
          .from('customers')
          .update({ pipeline: 'Tiềm năng' })
          .eq('id', cid)
          .eq('pipeline', 'Báo giá')
        if (!rollbackErr) pipelineRolledBack++
      }
    }

    // ── 3. Sprint 3: Notify nhân viên về BG sắp hết hạn trong 3 ngày ──────────
    const in3Days = new Date(Date.now() + 3 * 86_400_000).toISOString().split('T')[0]

    const { data: soonExpiring } = await supabase
      .from('quotes')
      .select('id, ma_bao_gia, nguoi_phu_trach, lark_record_id')
      .lte('ngay_het_han', in3Days)
      .gte('ngay_het_han', today)
      .in('trang_thai', ['Nháp', 'Đã gửi', 'Đàm phán', 'Chờ duyệt'])
      .not('nguoi_phu_trach', 'is', null)

    let soonNotified = 0
    const todayStr = today

    for (const q of soonExpiring ?? []) {
      // Dedup: chỉ 1 reminder/quote/ngày
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', q.nguoi_phu_trach)
        .eq('type', 'quote_expiry_soon')
        .like('link', `%${q.lark_record_id ?? q.id}%`)
        .gte('created_at', `${todayStr}T00:00:00Z`)
        .maybeSingle()

      if (existing) continue

      await supabase.from('notifications').insert({
        user_id: q.nguoi_phu_trach,
        type:    'quote_expiry_soon',
        title:   'Báo giá sắp hết hạn',
        body:    `${q.ma_bao_gia} sẽ hết hạn trong 3 ngày. Hãy follow-up khách hàng!`,
        link:    `/dashboard/orders/quote/${q.lark_record_id ?? q.id}`,
      })
      soonNotified++
    }

    console.log(`[cron/quote-expiry] Expired: ${expired?.length ?? 0}, pipeline rollback: ${pipelineRolledBack}, soon-notify: ${soonNotified}`)
    return NextResponse.json({
      expired:             expired?.length ?? 0,
      pipelineRolledBack,
      soonNotified,
    })
  } catch (err) {
    console.error('cron/quote-expiry:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
