import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['admin', 'ceo', 'director']

// ─── GET /api/lark/products/stats ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!ADMIN_ROLES.includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const period = req.nextUrl.searchParams.get('period') ?? '30d'
    // TODO: filter by period (30d / 90d / ytd) when product_sales_stats supports date range

    const { data, error } = await supabase
      .from('product_sales_stats')
      .select('*')
      .order('doanh_thu', { ascending: false })
      .limit(20)
    if (error) throw error

    return NextResponse.json({
      data: data ?? [],
      period,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('GET /api/lark/products/stats:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
