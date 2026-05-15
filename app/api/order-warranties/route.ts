import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface OrderWarranty {
  id:         number
  order_id:   number | null
  bat_dau:    string   // YYYY-MM-DD
  het_han:    string   // YYYY-MM-DD
  loai_bh:    string
  ghi_chu:    string | null
  created_at: string
  // joined
  ma_hd?:     string | null
  ten_kh?:    string | null
  // computed
  is_expired: boolean
  days_left:  number   // negative = expired
}

function mapWarranty(r: any): OrderWarranty {
  const het_han = new Date(r.het_han).getTime()
  const now     = Date.now()
  const days_left = Math.ceil((het_han - now) / 86_400_000)
  return {
    id:         r.id,
    order_id:   r.order_id ?? null,
    bat_dau:    r.bat_dau,
    het_han:    r.het_han,
    loai_bh:    r.loai_bh ?? '24 tháng',
    ghi_chu:    r.ghi_chu ?? null,
    created_at: r.created_at,
    ma_hd:      r.orders?.ma_hd   ?? null,
    ten_kh:     r.orders?.customers?.ho_ten ?? null,
    is_expired: days_left < 0,
    days_left,
  }
}

const SELECT = `*, orders!order_id(ma_hd, customers!customer_id(ho_ten))`

// ─── GET /api/order-warranties?expired=true|false&order_id=xxx ───────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const expired  = req.nextUrl.searchParams.get('expired')
    const orderId  = req.nextUrl.searchParams.get('order_id')

    let query = supabase.from('order_warranties').select(SELECT)
      .order('het_han', { ascending: true })

    if (orderId) query = query.eq('order_id', parseInt(orderId))

    const { data, error } = await query.limit(200)
    if (error) throw error

    const mapped = (data ?? []).map(mapWarranty)

    // Filter expired/active after mapping (computed field)
    const filtered = expired === 'true'
      ? mapped.filter(w => w.is_expired)
      : expired === 'false'
      ? mapped.filter(w => !w.is_expired)
      : mapped

    return NextResponse.json({ data: filtered })
  } catch (err) {
    console.error('GET /api/order-warranties:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/order-warranties ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const ALLOWED = ['admin', 'ceo', 'director', 'sales', 'tech']
    if (!profile || !ALLOWED.includes(profile.role)) {
      return NextResponse.json({ error: 'Không có quyền tạo bảo hành' }, { status: 403 })
    }

    const body = await req.json()
    const { order_id, bat_dau, het_han, loai_bh, ghi_chu } = body
    if (!bat_dau || !het_han) {
      return NextResponse.json({ error: 'Thiếu ngày bắt đầu / kết thúc' }, { status: 400 })
    }

    const { data, error } = await supabase.from('order_warranties').insert({
      order_id:   order_id ? parseInt(order_id) : null,
      bat_dau,
      het_han,
      loai_bh:    loai_bh  ?? '24 tháng',
      ghi_chu:    ghi_chu  ?? null,
      created_by: user.id,
    }).select(SELECT).single()

    if (error) throw error
    return NextResponse.json({ data: mapWarranty(data) }, { status: 201 })
  } catch (err) {
    console.error('POST /api/order-warranties:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
