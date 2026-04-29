import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface WarrantyTicket {
  id:               number
  warranty_id:      number | null
  order_id:         number | null
  customer_id:      number | null
  title:            string
  mo_ta:            string | null
  priority:         string
  trang_thai:       string
  nguoi_xu_ly:      string | null
  nguoi_xu_ly_name: string | null
  created_by:       string | null
  created_by_name:  string | null
  created_at:       string
  updated_at:       string
  // joined
  khach_hang?:      string | null
  ma_hd?:           string | null
}

function mapTicket(r: any): WarrantyTicket {
  return {
    id:               r.id,
    warranty_id:      r.warranty_id,
    order_id:         r.order_id,
    customer_id:      r.customer_id,
    title:            r.title,
    mo_ta:            r.mo_ta            ?? null,
    priority:         r.priority         ?? 'Bình thường',
    trang_thai:       r.trang_thai       ?? 'Chờ xử lý',
    nguoi_xu_ly:      r.nguoi_xu_ly      ?? null,
    nguoi_xu_ly_name: r.nguoi_xu_ly_name ?? null,
    created_by:       r.created_by       ?? null,
    created_by_name:  r.created_by_name  ?? null,
    created_at:       r.created_at,
    updated_at:       r.updated_at,
    khach_hang:       r.customers?.ho_ten ?? null,
    ma_hd:            r.orders?.ma_hd     ?? null,
  }
}

const SELECT = `*, customers(ho_ten), orders(ma_hd)`

// ─── GET /api/warranty-tickets?order_id=xxx hoặc ?all=true ───────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orderId = req.nextUrl.searchParams.get('order_id')
    const allFlag = req.nextUrl.searchParams.get('all')
    const status  = req.nextUrl.searchParams.get('status')

    let query = supabase.from('warranty_tickets').select(SELECT)
      .order('created_at', { ascending: false })

    if (orderId) {
      query = query.eq('order_id', parseInt(orderId))
    } else if (!allFlag) {
      return NextResponse.json({ error: 'Thiếu order_id hoặc ?all=true' }, { status: 400 })
    }

    if (status && status !== 'all') query = query.eq('trang_thai', status)

    const { data, error } = await query.limit(100)
    if (error) throw error
    return NextResponse.json({ data: (data ?? []).map(mapTicket) })
  } catch (err) {
    console.error('GET /api/warranty-tickets:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/warranty-tickets ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const body = await req.json()
    const { warranty_id, order_id, customer_id, title, mo_ta, priority } = body

    if (!title) return NextResponse.json({ error: 'Thiếu tiêu đề' }, { status: 400 })

    const { data, error } = await supabase.from('warranty_tickets').insert({
      warranty_id:     warranty_id   ?? null,
      order_id:        order_id      ? parseInt(order_id)    : null,
      customer_id:     customer_id   ? parseInt(customer_id) : null,
      title,
      mo_ta:           mo_ta         ?? null,
      priority:        priority      ?? 'Bình thường',
      trang_thai:      'Chờ xử lý',
      created_by:      user.id,
      created_by_name: profile.full_name ?? '',
      updated_at:      new Date().toISOString(),
    }).select(SELECT).single()

    if (error) throw error
    return NextResponse.json({ data: mapTicket(data) }, { status: 201 })
  } catch (err) {
    console.error('POST /api/warranty-tickets:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
