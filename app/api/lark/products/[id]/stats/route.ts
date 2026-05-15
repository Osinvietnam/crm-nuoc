import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['admin', 'ceo', 'director']

// ─── GET /api/lark/products/[id]/stats ───────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!ADMIN_ROLES.includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const { data: stats, error: statsErr } = await supabase
      .from('product_sales_stats')
      .select('*')
      .eq('product_id', id)
      .maybeSingle()
    if (statsErr) throw statsErr

    // 5 orders gần nhất có sản phẩm này: quote_items → quotes → orders
    const { data: recentOrders, error: ordersErr } = await supabase
      .from('quote_items')
      .select(`
        id,
        so_luong,
        don_gia,
        quotes!inner(
          id,
          ma_bao_gia,
          created_at,
          orders(id, ma_don_hang, trang_thai, created_at)
        )
      `)
      .eq('product_id', id)
      .order('created_at', { referencedTable: 'quotes', ascending: false })
      .limit(5)
    if (ordersErr) throw ordersErr

    const orders = (recentOrders ?? []).map((qi: any) => ({
      quote_item_id: qi.id,
      so_luong: qi.so_luong,
      don_gia: qi.don_gia,
      quote_id: qi.quotes?.id ?? null,
      ma_bao_gia: qi.quotes?.ma_bao_gia ?? null,
      quote_created_at: qi.quotes?.created_at ?? null,
      order_id: qi.quotes?.orders?.id ?? null,
      ma_don_hang: qi.quotes?.orders?.ma_don_hang ?? null,
      trang_thai: qi.quotes?.orders?.trang_thai ?? null,
      order_created_at: qi.quotes?.orders?.created_at ?? null,
    }))

    return NextResponse.json({ stats: stats ?? null, recent_orders: orders })
  } catch (err) {
    console.error('GET /api/lark/products/[id]/stats:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
