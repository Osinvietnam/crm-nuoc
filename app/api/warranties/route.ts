import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface Warranty {
  id:         number
  order_id:   number | null
  bat_dau:    string
  het_han:    string
  loai_bh:    string
  ghi_chu:    string | null
  created_at: string
  is_active:  boolean
  days_left:  number
}

function mapWarranty(r: any): Warranty {
  const today    = new Date().toDateString()
  const hetHan   = new Date(r.het_han)
  const daysLeft = Math.ceil((hetHan.getTime() - new Date(today).getTime()) / 86_400_000)
  return {
    id:         r.id,
    order_id:   r.order_id,
    bat_dau:    r.bat_dau,
    het_han:    r.het_han,
    loai_bh:    r.loai_bh ?? '24 tháng',
    ghi_chu:    r.ghi_chu ?? null,
    created_at: r.created_at,
    is_active:  daysLeft > 0,
    days_left:  daysLeft,
  }
}

// ─── GET /api/warranties?order_id=xxx ────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orderId = req.nextUrl.searchParams.get('order_id')
    if (!orderId) return NextResponse.json({ error: 'Thiếu order_id' }, { status: 400 })

    const { data, error } = await supabase
      .from('order_warranties')
      .select('*')
      .eq('order_id', parseInt(orderId))
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data: (data ?? []).map(mapWarranty) })
  } catch (err) {
    console.error('GET /api/warranties:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/warranties ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('id, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const body = await req.json()
    const { order_id, bat_dau, het_han, loai_bh, ghi_chu } = body

    if (!order_id || !bat_dau || !het_han) {
      return NextResponse.json({ error: 'Thiếu order_id, bat_dau hoặc het_han' }, { status: 400 })
    }

    const { data, error } = await supabase.from('order_warranties').insert({
      order_id:   parseInt(order_id),
      bat_dau,
      het_han,
      loai_bh:    loai_bh   ?? '24 tháng',
      ghi_chu:    ghi_chu   ?? null,
      created_by: user.id,
    }).select().single()

    if (error) throw error
    return NextResponse.json({ data: mapWarranty(data) }, { status: 201 })
  } catch (err) {
    console.error('POST /api/warranties:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
