import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapQuote } from './_mappers'
import { logAudit } from '@/lib/audit'

// ─── Tạo mã báo giá tự động ──────────────────────────────────────────────────

function genMaBaoGia(): string {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const tail  = String(Date.now()).slice(-4)
  return `BG-${year}${month}-${tail}`
}

const SELECT = `
  *,
  staff:nguoi_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt)
`

// ─── GET /api/lark/quotes ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    // customer_record_id = Supabase customer id (string) — filter quotes by customer
    const customerIdParam = req.nextUrl.searchParams.get('customer_record_id')

    const pageParam     = req.nextUrl.searchParams.get('page')
    const pageSizeParam = req.nextUrl.searchParams.get('pageSize')
    const page     = Math.max(1, parseInt(pageParam     ?? '1'))
    const pageSize = Math.min(100, Math.max(10, parseInt(pageSizeParam ?? '50')))
    const from = (page - 1) * pageSize
    const to   = from + pageSize - 1

    let query = supabase.from('quotes').select(SELECT, { count: 'exact' }).order('created_at', { ascending: false })

    if (customerIdParam) {
      query = query.eq('customer_id', parseInt(customerIdParam))
    } else if (profile.role === 'sales') {
      query = query.eq('nguoi_phu_trach', profile.id)
    }

    const { data, error, count } = await query.range(from, to)
    if (error) throw error

    return NextResponse.json({
      data: (data ?? []).map(mapQuote),
      meta: {
        page,
        pageSize,
        total: count ?? 0,
        hasMore: to < (count ?? 0) - 1,
      },
    })
  } catch (err) {
    console.error('GET /api/lark/quotes:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/lark/quotes ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    if (!['admin', 'ceo', 'sales'].includes(profile.role)) {
      return NextResponse.json({ error: 'Không có quyền tạo báo giá' }, { status: 403 })
    }

    const body = await req.json()
    const {
      tong_gia_tri, chiet_khau,
      ghi_chu_ky_thuat, ghi_chu_thuong_mai,
      kenh_tiep_nhan, ngay_gui_kh,
      customer_record_id,  // = Supabase customer id
      // NOTE: san_pham không phải cột trong quotes — sản phẩm lưu qua quote_items
    } = body

    const customerId = customer_record_id ? parseInt(customer_record_id) : null

    // Phiên bản tự tăng cho cùng khách hàng
    let phien_ban = 1
    if (customerId) {
      const { data: existing } = await supabase
        .from('quotes')
        .select('phien_ban')
        .eq('customer_id', customerId)
        .order('phien_ban', { ascending: false })
        .limit(1)
      phien_ban = (existing?.[0]?.phien_ban ?? 0) + 1
    }

    // M3: Lấy số ngày hạn BG từ company_settings (default 14)
    let expiryDays = 14
    const { data: settings } = await supabase
      .from('company_settings')
      .select('quote_expiry_days')
      .limit(1)
      .single()
    if (settings?.quote_expiry_days) expiryDays = settings.quote_expiry_days

    const today       = new Date().toISOString().split('T')[0]
    const twoWeeksOut = new Date(Date.now() + expiryDays * 86_400_000).toISOString().split('T')[0]
    const ngayGuiStr  = ngay_gui_kh
      ? new Date(Number(ngay_gui_kh)).toISOString().split('T')[0]
      : null

    const { data, error } = await supabase
      .from('quotes')
      .insert({
        ma_bao_gia:         genMaBaoGia(),
        customer_id:        customerId,
        nguoi_phu_trach:    profile.id,
        phien_ban,
        trang_thai:         'Nháp',
        tong_gia_tri:       Number(tong_gia_tri) || 0,
        chiet_khau:         Number(chiet_khau)   || 0,
        kenh_tiep_nhan:     kenh_tiep_nhan       || null,
        ghi_chu_ky_thuat:   ghi_chu_ky_thuat     || null,
        ghi_chu_thuong_mai: ghi_chu_thuong_mai   || null,
        ngay_lap:           today,
        ngay_het_han:       twoWeeksOut,
        ngay_gui_kh:        ngayGuiStr,
      })
      .select(SELECT)
      .single()

    if (error) throw error

    // H1: Insert quote_items nếu có items structured
    if (Array.isArray(body.items) && body.items.length > 0 && data.id) {
      const itemsToInsert = body.items.map((item: { ten_sp: string; don_gia: number; so_luong: number; product_id?: number | null }) => ({
        quote_id:   data.id,
        product_id: item.product_id ?? null,
        ten_sp:     item.ten_sp,
        don_gia:    Number(item.don_gia) || 0,
        so_luong:   Number(item.so_luong) || 1,
        sort_order: 0,
      }))
      const { error: itemsErr } = await supabase.from('quote_items').insert(itemsToInsert)
      if (itemsErr) console.error('Insert quote_items:', itemsErr.message)
    }

    // H3: Audit log tạo báo giá
    void logAudit(supabase, {
      user_id:   user.id,
      user_name: profile.full_name,
      action:    'quote_created',
      entity:    'quote',
      detail:    `Tạo BG ${data.ma_bao_gia} cho KH ${data.customers?.ho_ten ?? 'N/A'} (v${data.phien_ban})`,
    })

    // Cập nhật pipeline KH → "Báo giá"
    if (customerId) {
      void supabase
        .from('customers')
        .update({ pipeline: 'Báo giá' })
        .eq('id', customerId)
        .in('pipeline', ['Lead mới', 'Tiềm năng'])
    }

    return NextResponse.json({ data: mapQuote(data) }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/lark/quotes:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
