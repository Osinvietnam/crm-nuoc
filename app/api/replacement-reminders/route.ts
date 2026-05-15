import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/replacement-reminders ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = req.nextUrl.searchParams
    const dueSoon  = searchParams.get('due_soon') === 'true'
    const orderId  = searchParams.get('order_id')
    const myOnly   = searchParams.get('my') === 'true'

    const today = new Date()
    const in30  = new Date(today)
    in30.setDate(in30.getDate() + 30)
    const todayStr = today.toISOString().split('T')[0]
    const in30Str  = in30.toISOString().split('T')[0]

    let query = supabase
      .from('replacement_reminders')
      .select(`
        *,
        products  (ten_sp),
        customers (ho_ten),
        orders    (ma_hd)
      `)
      .order('ngay_nhac_tiep', { ascending: true })

    if (dueSoon) {
      query = query
        .lte('ngay_nhac_tiep', in30Str)
        .eq('is_done', false)
    }
    if (orderId) {
      query = query.eq('order_id', orderId)
    }
    if (myOnly) {
      query = query.eq('assigned_to', user.id)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = data ?? []
    const overdue_count  = rows.filter((r: any) => !r.is_done && r.ngay_nhac_tiep < todayStr).length
    const due_soon_count = rows.filter((r: any) => !r.is_done && r.ngay_nhac_tiep >= todayStr && r.ngay_nhac_tiep <= in30Str).length

    return NextResponse.json({ data: rows, overdue_count, due_soon_count })
  } catch (err) {
    console.error('GET /api/replacement-reminders:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/replacement-reminders ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'ceo', 'director', 'sales', 'tech'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    if (!body.product_id) {
      return NextResponse.json({ error: 'product_id là bắt buộc' }, { status: 400 })
    }
    if (!body.ngay_nhac_tiep) {
      return NextResponse.json({ error: 'ngay_nhac_tiep là bắt buộc' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('replacement_reminders')
      .insert({
        order_id:      body.order_id      || null,
        product_id:    body.product_id,
        customer_id:   body.customer_id   || null,
        ngay_lap_dat:  body.ngay_lap_dat  || null,
        ngay_nhac_tiep: body.ngay_nhac_tiep,
        assigned_to:   body.assigned_to   || null,
        ghi_chu:       body.ghi_chu       || null,
        is_done:       false,
        created_by:    user.id,
      })
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/replacement-reminders:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
