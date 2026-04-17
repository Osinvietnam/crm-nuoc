import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Vercel Cron — chạy mỗi 6h (cấu hình trong vercel.json)
// GET /api/cron/quote-expiry
export async function GET(req: Request) {
  // Verify cron secret (Vercel tự inject header này)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Service client để bypass RLS cho bulk update
    const supabase = createServiceClient()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('quotes')
      .update({ trang_thai: 'Hết hạn' })
      .lt('ngay_het_han', today)
      .in('trang_thai', ['Nháp', 'Đã gửi', 'Đàm phán'])
      .select('id, ma_bao_gia')

    if (error) throw error

    console.log(`[cron/quote-expiry] Expired ${data?.length ?? 0} quotes`)
    return NextResponse.json({ expired: data?.length ?? 0 })
  } catch (err) {
    console.error('cron/quote-expiry:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
