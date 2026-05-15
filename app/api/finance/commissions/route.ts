import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// ─── GET /api/finance/commissions?is_paid=false&thang=&nam= ──────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director', 'accountant'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const is_paid_param = req.nextUrl.searchParams.get('is_paid')
    const thang = req.nextUrl.searchParams.get('thang')
    const nam   = req.nextUrl.searchParams.get('nam')

    const service = createServiceClient()
    let query = service
      .from('orders')
      .select(`
        id, ma_hd, gia_tri_hd, hh_phan_tram, hh_kinh_doanh,
        hh_da_tra, hh_ngay_tra, trang_thai, ngay_ky,
        staff:nguoi_phu_trach(id, full_name),
        customers!customer_id(ho_ten)
      `)
      .eq('type', 'b2c')
      .gt('hh_kinh_doanh', 0)
      .order('ngay_ky', { ascending: false })

    if (is_paid_param !== null) {
      query = query.eq('hh_da_tra', is_paid_param === 'true')
    }
    if (thang && nam) {
      const from = new Date(Number(nam), Number(thang) - 1, 1).toISOString().split('T')[0]
      const to   = new Date(Number(nam), Number(thang), 0).toISOString().split('T')[0]
      query = query.gte('hh_ngay_tra', from).lte('hh_ngay_tra', to)
    }

    const { data, error } = await query
    if (error) throw error

    const tong_chua_tra = (data ?? [])
      .filter(o => !o.hh_da_tra)
      .reduce((s, o) => s + (o.hh_kinh_doanh ?? 0), 0)

    return NextResponse.json({ data: data ?? [], tong_chua_tra })
  } catch (err) {
    console.error('GET /api/finance/commissions:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/finance/commissions — Đánh dấu đã trả (batch) ────────────────
// body: { order_ids: number[], paid_date: string }

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director', 'accountant'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const body = await req.json()
    const { order_ids, paid_date, is_paid = true } = body

    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json({ error: 'Thiếu order_ids' }, { status: 400 })
    }

    const service = createServiceClient()

    // FIN-07: validate hoa hồng không vượt giới hạn cho phép trước khi mark paid
    if (is_paid) {
      const { data: ordersToCheck } = await service
        .from('orders')
        .select('id, ma_hd, gia_tri_hd, hh_phan_tram, hh_kinh_doanh')
        .in('id', order_ids)

      const invalid = (ordersToCheck ?? []).filter(o => {
        // Bỏ qua validation khi hh_phan_tram = null (không đặt hạn mức hoa hồng)
        if (o.hh_phan_tram == null) return false
        const maxAllowed = Math.round((o.gia_tri_hd ?? 0) * o.hh_phan_tram / 100)
        return (o.hh_kinh_doanh ?? 0) > maxAllowed
      })

      if (invalid.length > 0) {
        return NextResponse.json({
          error: `Hoa hồng vượt giới hạn cho phép: ${invalid.map(o => o.ma_hd).join(', ')}`,
          invalid_orders: invalid.map(o => ({
            id:            o.id,
            ma_hd:         o.ma_hd,
            hh_kinh_doanh: o.hh_kinh_doanh,
            max_allowed:   o.hh_phan_tram != null ? Math.round((o.gia_tri_hd ?? 0) * o.hh_phan_tram / 100) : null,
          })),
        }, { status: 422 })
      }
    }

    const updates: Record<string, unknown> = {
      hh_da_tra:  is_paid,
      updated_at: new Date().toISOString(),
    }
    if (is_paid && paid_date) updates.hh_ngay_tra = paid_date
    if (!is_paid)             updates.hh_ngay_tra = null

    const { data, error } = await service
      .from('orders')
      .update(updates)
      .in('id', order_ids)
      .select('id, ma_hd, hh_kinh_doanh, hh_da_tra, hh_ngay_tra')

    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? '',
      action:    is_paid ? 'commission_paid' : 'commission_unpaid',
      entity:    'commission',
      detail:    `${order_ids.length} đơn — ngày: ${paid_date ?? 'n/a'}`,
    })

    return NextResponse.json({
      success: true,
      updated: data?.length ?? 0,
      tong_da_tra: (data ?? []).reduce((s, o) => s + (o.hh_kinh_doanh ?? 0), 0),
    })
  } catch (err) {
    console.error('PATCH /api/finance/commissions:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
