import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapQuote } from '../_mappers'

const SELECT = `
  *,
  staff:nguoi_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt, dia_chi_ct, dia_chi_hd)
`

// ─── GET /api/lark/quotes/[id] ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const query = supabase.from('quotes').select(SELECT)
    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    return NextResponse.json({ data: mapQuote(data) })
  } catch (err) {
    console.error('GET /api/lark/quotes/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/lark/quotes/[id] ─────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body   = await req.json()

    const allowed = [
      'trang_thai', 'ly_do_tu_choi', 'ma_hd_tham_chieu', 'tong_gia_tri',
      'chiet_khau', 'san_pham', 'ghi_chu_ky_thuat', 'ghi_chu_thuong_mai',
      'kenh_tiep_nhan', 'ket_qua_follow_up',
    ]
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    // Date fields — convert ms timestamp to ISO date string
    if ('ngay_gui_kh' in body) {
      updates.ngay_gui_kh = body.ngay_gui_kh
        ? new Date(Number(body.ngay_gui_kh)).toISOString().split('T')[0]
        : null
    }
    if ('ngay_follow_up' in body) {
      updates.ngay_follow_up = body.ngay_follow_up
        ? new Date(Number(body.ngay_follow_up)).toISOString().split('T')[0]
        : null
    }

    const query = supabase.from('quotes').update(updates).select(SELECT)
    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error) throw error

    // Automation: Báo giá chấp nhận → KH pipeline → "Chốt HĐ"
    // Guard: chỉ update nếu KH đang ở 'Báo giá' hoặc 'Đàm phán' (tránh kéo lùi KH đã qua stage)
    if (body.trang_thai === 'Chấp nhận' && data.customer_id) {
      void supabase.from('customers')
        .update({ pipeline: 'Chốt HĐ' })
        .in('pipeline', ['Báo giá', 'Đàm phán'])
        .eq('id', data.customer_id)
    }

    // Automation: Từ chối → KH pipeline → "Đàm phán"
    // Guard: chỉ update nếu KH đang ở 'Báo giá' (tránh kéo lùi KH đã qua Đàm phán/Chốt HĐ trở đi)
    if (body.trang_thai === 'Từ chối' && data.customer_id) {
      void supabase.from('customers')
        .update({ pipeline: 'Đàm phán' })
        .in('pipeline', ['Báo giá'])
        .eq('id', data.customer_id)
    }

    return NextResponse.json({ data: mapQuote(data) })
  } catch (err) {
    console.error('PATCH /api/lark/quotes/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
