import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapQuote } from './_mappers'

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

    let query = supabase.from('quotes').select(SELECT).order('created_at', { ascending: false })

    if (customerIdParam) {
      query = query.eq('customer_id', parseInt(customerIdParam))
    } else if (profile.role === 'sales') {
      query = query.eq('nguoi_phu_trach', profile.id)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: (data ?? []).map(mapQuote) })
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
      san_pham, tong_gia_tri, chiet_khau,
      ghi_chu_ky_thuat, ghi_chu_thuong_mai,
      kenh_tiep_nhan, ngay_gui_kh,
      customer_record_id,  // = Supabase customer id
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

    // san_pham arrives as a comma-separated string from itemsToLarkFields
    const sanPhamArr = typeof san_pham === 'string'
      ? san_pham.split(',').map((s: string) => s.trim()).filter(Boolean)
      : (Array.isArray(san_pham) ? san_pham : [])

    const today       = new Date().toISOString().split('T')[0]
    const twoWeeksOut = new Date(Date.now() + 14 * 86_400_000).toISOString().split('T')[0]
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
        san_pham:           sanPhamArr,
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
