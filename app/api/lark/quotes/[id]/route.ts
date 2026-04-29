import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapQuote } from '../_mappers'
import { logAudit } from '@/lib/audit'

const SELECT = `
  *,
  staff:nguoi_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt, dia_chi_ct, dia_chi_hd),
  quote_items(id, product_id, ten_sp, don_gia, so_luong, thanh_tien, sort_order)
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

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const { id } = await params
    const body   = await req.json()

    // C3 guard: fetch current quote trước
    const fetchQuery = supabase.from('quotes').select('id, trang_thai, tong_gia_tri, chiet_khau, customer_id, ngay_gui_kh')
    const { data: current, error: fetchErr } = await (/^\d+$/.test(id)
      ? fetchQuery.eq('id', parseInt(id))
      : fetchQuery.eq('lark_record_id', id)
    ).single()
    if (fetchErr || !current) return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 })

    // C3: Nếu báo giá đã bị khóa, xóa các field nhạy cảm khỏi body
    const isLocked = ['Chấp nhận', 'Từ chối'].includes(current.trang_thai)
    if (isLocked) {
      const LOCKED_BLOCKED = ['san_pham', 'tong_gia_tri', 'chiet_khau', 'kenh_tiep_nhan', 'ngay_gui_kh', 'ma_hd_tham_chieu']
      for (const f of LOCKED_BLOCKED) delete body[f]
    }

    // M6: State machine — block nhảy trạng thái không hợp lệ (trừ admin/ceo)
    if (body.trang_thai && body.trang_thai !== current.trang_thai) {
      const isManager = ['admin', 'ceo', 'director'].includes(profile.role)
      if (!isManager) {
        // Định nghĩa chuyển trạng thái hợp lệ — chỉ manager mới duyệt 'Chấp nhận'
        const ALLOWED_TRANSITIONS: Record<string, string[]> = {
          'Nháp':       ['Đã gửi', 'Hết hạn'],
          'Đã gửi':    ['Đàm phán', 'Chờ duyệt', 'Từ chối', 'Hết hạn'],
          'Đàm phán':   ['Chờ duyệt', 'Từ chối', 'Hết hạn'],
          'Chờ duyệt':  [],           // Chỉ manager mới duyệt hoặc từ chối
          'Chấp nhận':  [],           // Terminal cho non-manager
          'Từ chối':    [],           // Terminal (chỉ admin)
          'Hết hạn':    ['Nháp', 'Đã gửi'],
        }
        const allowed = ALLOWED_TRANSITIONS[current.trang_thai] ?? []
        if (!allowed.includes(body.trang_thai)) {
          return NextResponse.json({
            error: `Không thể chuyển từ "${current.trang_thai}" sang "${body.trang_thai}"`,
          }, { status: 422 })
        }
      }
    }

    const allowed = [
      'trang_thai', 'ly_do_tu_choi', 'ma_hd_tham_chieu', 'tong_gia_tri',
      'chiet_khau', 'ghi_chu_ky_thuat', 'ghi_chu_thuong_mai',
      'kenh_tiep_nhan', 'ket_qua_follow_up',
      // NOTE: 'san_pham' không phải cột trong bảng quotes — sản phẩm lưu qua quote_items
    ]
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    // M2: Recompute gia_tri_sau_ck server-side
    if ('tong_gia_tri' in updates || 'chiet_khau' in updates) {
      const tong = Number('tong_gia_tri' in updates ? updates.tong_gia_tri : current.tong_gia_tri) || 0
      const ck   = Number('chiet_khau'   in updates ? updates.chiet_khau   : current.chiet_khau)  || 0
      updates.gia_tri_sau_ck = Math.round(tong * (1 - ck / 100))
    }

    // SAL-04: Sales vượt chiết khấu tối đa → auto chuyển sang 'Chờ duyệt' thay vì block
    if (profile.role === 'sales' && 'chiet_khau' in updates) {
      const { data: rules } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'sales_max_discount_pct')
        .maybeSingle()
      const maxDiscount = Number(rules?.value ?? 5)
      const ck = Number(updates.chiet_khau) || 0
      if (ck > maxDiscount && updates.trang_thai !== 'Chờ duyệt' && current.trang_thai !== 'Chờ duyệt') {
        updates.trang_thai = 'Chờ duyệt'
      }
    }

    // M4: Tự set ngay_gui_kh khi chuyển "Đã gửi"
    if (body.trang_thai === 'Đã gửi' && !current.ngay_gui_kh && !body.ngay_gui_kh) {
      updates.ngay_gui_kh = new Date().toISOString().split('T')[0]
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

    // H3: Audit log khi thay đổi trạng thái quan trọng
    if (body.trang_thai && ['Chấp nhận', 'Từ chối', 'Hết hạn'].includes(body.trang_thai)) {
      void logAudit(supabase, {
        user_id:   user.id,
        user_name: profile.full_name,
        action:    'quote_status_changed',
        entity:    'quote',
        detail:    `BG ${data.ma_bao_gia} → ${body.trang_thai}`,
      })
    }

    // H2: Sync quote_items khi PATCH có items
    if (Array.isArray(body.items) && !isLocked) {
      // Xóa items cũ
      await supabase.from('quote_items').delete().eq('quote_id', data.id)
      // Insert items mới
      if (body.items.length > 0) {
        const newItems = body.items.map((item: { ten_sp: string; don_gia: number; so_luong: number; product_id?: number | null }, idx: number) => ({
          quote_id:   data.id,
          product_id: item.product_id ?? null,
          ten_sp:     item.ten_sp,
          don_gia:    Number(item.don_gia) || 0,
          so_luong:   Number(item.so_luong) || 1,
          sort_order: idx,
        }))
        const { error: itemsErr } = await supabase.from('quote_items').insert(newItems)
        if (itemsErr) console.error('Sync quote_items:', itemsErr.message)
      }
    }

    return NextResponse.json({ data: mapQuote(data) })
  } catch (err) {
    console.error('PATCH /api/lark/quotes/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
