import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapContract, mapCommercial, mapProject } from './_mappers'

export type { Contract, CommercialOrder, Project } from './_mappers'

// ─── SELECT strings ───────────────────────────────────────────────────────────

const B2C_SELECT = `
  *,
  staff:nguoi_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt)
`
const COMMERCIAL_SELECT = `
  *,
  staff:nguoi_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt)
`
const PROJECT_SELECT = `
  *,
  staff:nguoi_phu_trach(id, full_name)
`

// ─── Code generators ─────────────────────────────────────────────────────────

function genCode(prefix: string): string {
  const now = new Date()
  return `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-4)}`
}

// ─── GET /api/lark/orders ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const tab          = req.nextUrl.searchParams.get('tab') ?? 'b2c'
    const customerParam = req.nextUrl.searchParams.get('customer_id')
    const isSales      = profile.role === 'sales'

    if (tab === 'b2c') {
      let query = supabase.from('orders').select(B2C_SELECT)
        .eq('type', 'b2c').order('created_at', { ascending: false })
      if (customerParam)   query = query.eq('customer_id', parseInt(customerParam))
      else if (isSales)    query = query.eq('nguoi_phu_trach', profile.id)
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ data: (data ?? []).map(mapContract) })
    }

    if (tab === 'commercial') {
      let query = supabase.from('orders').select(COMMERCIAL_SELECT)
        .eq('type', 'commercial').order('created_at', { ascending: false })
      if (isSales) query = query.eq('nguoi_phu_trach', profile.id)
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ data: (data ?? []).map(mapCommercial) })
    }

    if (tab === 'projects') {
      let query = supabase.from('orders').select(PROJECT_SELECT)
        .eq('type', 'project').order('created_at', { ascending: false })
      if (isSales) query = query.eq('nguoi_phu_trach', profile.id)
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ data: (data ?? []).map(mapProject) })
    }

    return NextResponse.json({ error: 'Tab không hợp lệ' }, { status: 400 })
  } catch (err) {
    console.error('GET /api/lark/orders:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/lark/orders ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    if (!['admin', 'ceo', 'sales'].includes(profile.role)) {
      return NextResponse.json({ error: 'Không có quyền tạo đơn hàng' }, { status: 403 })
    }

    const tab   = req.nextUrl.searchParams.get('tab') ?? 'b2c'
    const body  = await req.json()
    const today = new Date().toISOString().split('T')[0]

    // ── B2C (Hợp đồng) ───────────────────────────────────────────────────────
    if (tab === 'b2c') {
      const { ma_hd, san_pham, gia_tri_hd, gia_tri_gws, dia_chi_ct, ngay_ky, ghi_chu, customer_id, quote_record_id } = body
      if (!gia_tri_hd) {
        return NextResponse.json({ error: 'Giá trị HĐ là bắt buộc' }, { status: 400 })
      }
      const sanPhamArr = typeof san_pham === 'string'
        ? san_pham.split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(san_pham) ? san_pham : [])

      // C3: quote.record_id = String(quotes.id) → dùng trực tiếp làm FK
      const quoteId: number | null = quote_record_id ? (parseInt(quote_record_id) || null) : null

      const { data, error } = await supabase.from('orders').insert({
        type:            'b2c',
        ma_hd:           ma_hd || genCode('HD'),
        customer_id:     customer_id ? parseInt(customer_id) : null,
        quote_id:        quoteId,
        nguoi_phu_trach: profile.id,
        trang_thai:      'Đã ký - Chờ TT đợt 1',
        san_pham:        sanPhamArr,
        gia_tri_hd:      Number(gia_tri_hd) || 0,
        gia_tri_gws:     Number(gia_tri_gws) || 0,
        dia_chi_ct:      dia_chi_ct || null,
        ngay_ky:         ngay_ky ? new Date(Number(ngay_ky)).toISOString().split('T')[0] : today,
        ghi_chu:         ghi_chu || null,
      }).select(B2C_SELECT).single()
      if (error) throw error

      // Sync customer pipeline → "Chốt HĐ" (guard: không kéo lùi KH đã ≥ Chốt HĐ)
      if (data.customer_id) {
        void supabase.from('customers')
          .update({ pipeline: 'Chốt HĐ' })
          .in('pipeline', ['Tiềm năng', 'Báo giá', 'Đàm phán'])
          .eq('id', data.customer_id)
      }

      // C3: Ghi mã HĐ + tự động chấp nhận BG (câu hỏi 3 xác nhận)
      if (quoteId && data.ma_hd) {
        void (async () => {
          const { error: linkErr } = await supabase.from('quotes')
            .update({
              ma_hd_tham_chieu: data.ma_hd,
              trang_thai:       'Chấp nhận',   // Auto-accept khi HĐ được tạo từ BG
            })
            .eq('id', quoteId)
            .neq('trang_thai', 'Chấp nhận')   // Idempotent: không ghi đè nếu đã accept
          if (linkErr) console.error('Quote back-link:', linkErr)
        })()
      }

      return NextResponse.json({ data: mapContract(data) }, { status: 201 })
    }

    // ── Commercial (Thương mại / Đại lý) ─────────────────────────────────────
    if (tab === 'commercial') {
      const { ten_kh, san_pham, so_luong, don_gia, loai_khach, tinh_thanh, phuong_thuc_tt, ghi_chu, customer_id } = body
      if (!ten_kh || !san_pham || !so_luong || !don_gia) {
        return NextResponse.json({ error: 'Tên KH, sản phẩm, số lượng và đơn giá là bắt buộc' }, { status: 400 })
      }
      const { data, error } = await supabase.from('orders').insert({
        type:            'commercial',
        ma_don:          genCode('DH'),
        nguoi_phu_trach: profile.id,
        customer_id:     customer_id ? parseInt(customer_id) : null,
        trang_thai:      'Chờ xác nhận',
        ten_kh_tm:       ten_kh,
        tinh_thanh:      tinh_thanh || null,
        san_pham_text:   san_pham,
        so_luong:        Number(so_luong),
        don_gia:         Number(don_gia),
        tong_tien:       Number(so_luong) * Number(don_gia),
        loai_khach:      loai_khach || 'Đại lý cấp 1',
        phuong_thuc_tt:  phuong_thuc_tt || 'Chuyển khoản',
        ngay_dat:        today,
        ghi_chu:         ghi_chu || null,
      }).select(COMMERCIAL_SELECT).single()
      if (error) throw error
      return NextResponse.json({ data: mapCommercial(data) }, { status: 201 })
    }

    // ── Project (Dự án) ───────────────────────────────────────────────────────
    if (tab === 'projects') {
      const { ten_da, chu_dau_tu, loai_da, quy_mo, tinh_thanh, gia_tri_dt, ty_le_thang, ghi_chu } = body
      if (!ten_da || !chu_dau_tu) {
        return NextResponse.json({ error: 'Tên dự án và chủ đầu tư là bắt buộc' }, { status: 400 })
      }
      const { data, error } = await supabase.from('orders').insert({
        type:            'project',
        ma_da:           genCode('DA'),
        nguoi_phu_trach: profile.id,
        ten_da,
        chu_dau_tu,
        giai_doan:       'Tìm hiểu',
        trang_thai:      'Tìm hiểu',
        loai_da:         loai_da    || null,
        quy_mo:          quy_mo     || null,
        tinh_thanh:      tinh_thanh || null,
        gia_tri_dt:      Number(gia_tri_dt)  || 0,
        ty_le_thang:     Number(ty_le_thang) || 0,
        ngay_bao_gia:    today,
        ghi_chu:         ghi_chu || null,
      }).select(PROJECT_SELECT).single()
      if (error) throw error
      return NextResponse.json({ data: mapProject(data) }, { status: 201 })
    }

    return NextResponse.json({ error: 'Tab không hợp lệ' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/lark/orders:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
