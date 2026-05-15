import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapQuote, type QuoteType } from './_mappers'
import { logAudit } from '@/lib/audit'

// ─── Tạo mã theo loại ─────────────────────────────────────────────────────────

function genMa(type: QuoteType): string {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const tail  = String(Date.now()).slice(-4)
  const prefix = type === 'commercial' ? 'TM' : type === 'project' ? 'DA' : 'BG'
  return `${prefix}-${year}${month}-${tail}`
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

    const customerIdParam = req.nextUrl.searchParams.get('customer_record_id')
    const typeParam       = req.nextUrl.searchParams.get('type') as QuoteType | null

    const pageParam     = req.nextUrl.searchParams.get('page')
    const pageSizeParam = req.nextUrl.searchParams.get('pageSize')
    const page     = Math.max(1, parseInt(pageParam     ?? '1'))
    const pageSize = Math.min(100, Math.max(10, parseInt(pageSizeParam ?? '50')))
    const from = (page - 1) * pageSize
    const to   = from + pageSize - 1

    let query = supabase.from('quotes').select(SELECT, { count: 'exact' }).order('created_at', { ascending: false })

    // Filter theo type
    if (typeParam && ['b2c', 'commercial', 'project'].includes(typeParam)) {
      query = query.eq('type', typeParam)
    }

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

    if (!['admin', 'ceo', 'director', 'sales'].includes(profile.role)) {
      return NextResponse.json({ error: 'Không có quyền tạo báo giá' }, { status: 403 })
    }

    const body = await req.json()
    const type: QuoteType = ['b2c', 'commercial', 'project'].includes(body.type) ? body.type : 'b2c'

    const {
      tong_gia_tri, chiet_khau,
      ghi_chu_ky_thuat, ghi_chu_thuong_mai,
      kenh_tiep_nhan, ngay_gui_kh,
      customer_record_id,
      // Thương mại
      loai_khach, tinh_thanh, phuong_thuc_tt,
      // Dự án
      ten_da, chu_dau_tu, loai_da, quy_mo,
      gia_tri_dt, ngay_nop_thau, doi_tac_da,
    } = body

    const customerId = customer_record_id ? parseInt(customer_record_id) : null

    // Phiên bản tự tăng cho cùng khách hàng + cùng type
    let phien_ban = 1
    if (customerId) {
      const { data: existing } = await supabase
        .from('quotes')
        .select('phien_ban')
        .eq('customer_id', customerId)
        .eq('type', type)
        .order('phien_ban', { ascending: false })
        .limit(1)
      phien_ban = (existing?.[0]?.phien_ban ?? 0) + 1
    }

    // Trạng thái khởi đầu theo type
    const INIT_STATUS: Record<QuoteType, string> = {
      b2c:        'Nháp',
      commercial: 'Báo giá',
      project:    'Chuẩn bị HS',
    }

    // Ngày hết hạn — chỉ áp dụng cho B2C
    let ngay_het_han: string | null = null
    if (type === 'b2c') {
      let expiryDays = 14
      const { data: settings } = await supabase
        .from('company_settings').select('quote_expiry_days').limit(1).single()
      if (settings?.quote_expiry_days) expiryDays = settings.quote_expiry_days
      ngay_het_han = new Date(Date.now() + expiryDays * 86_400_000).toISOString().split('T')[0]
    }

    const today = new Date().toISOString().split('T')[0]
    const ngayGuiStr = ngay_gui_kh
      ? new Date(Number(ngay_gui_kh)).toISOString().split('T')[0]
      : null

    const insertData: Record<string, unknown> = {
      type,
      ma_bao_gia:         genMa(type),
      customer_id:        customerId,
      nguoi_phu_trach:    profile.id,
      phien_ban,
      trang_thai:         INIT_STATUS[type],
      tong_gia_tri:       Number(tong_gia_tri) || 0,
      chiet_khau:         Number(chiet_khau)   || 0,
      kenh_tiep_nhan:     kenh_tiep_nhan       || null,
      ghi_chu_ky_thuat:   ghi_chu_ky_thuat     || null,
      ghi_chu_thuong_mai: ghi_chu_thuong_mai   || null,
      ngay_lap:           today,
      ngay_het_han,
      ngay_gui_kh:        ngayGuiStr,
    }

    // Fields thương mại
    if (type === 'commercial') {
      insertData.loai_khach     = loai_khach     || null
      insertData.tinh_thanh     = tinh_thanh     || null
      insertData.phuong_thuc_tt = phuong_thuc_tt || null
    }

    // Fields dự án
    if (type === 'project') {
      insertData.ten_da        = ten_da        || null
      insertData.chu_dau_tu    = chu_dau_tu    || null
      insertData.loai_da       = loai_da       || null
      insertData.quy_mo        = quy_mo        || null
      insertData.gia_tri_dt    = Number(gia_tri_dt) || 0
      insertData.tinh_thanh    = tinh_thanh    || null
      insertData.doi_tac_da    = doi_tac_da    || null
      insertData.ngay_nop_thau = ngay_nop_thau
        ? new Date(Number(ngay_nop_thau)).toISOString().split('T')[0]
        : null
    }

    const { data, error } = await supabase
      .from('quotes')
      .insert(insertData)
      .select(SELECT)
      .single()

    if (error) throw error

    // Insert quote_items nếu có
    if (Array.isArray(body.items) && body.items.length > 0 && data.id) {
      type InsertItem = { quote_id: number; product_id: number | null; ten_sp: string; don_gia: number; so_luong: number; sort_order: number }
      const itemsToInsert: InsertItem[] = body.items.map((item: { ten_sp: string; don_gia: number; so_luong: number; product_id?: number | null }, idx: number) => ({
        quote_id:   data.id,
        product_id: item.product_id ?? null,
        ten_sp:     item.ten_sp,
        don_gia:    Number(item.don_gia) || 0,
        so_luong:   Number(item.so_luong) || 1,
        sort_order: idx,
      }))

      const needLookup = itemsToInsert.filter((i: InsertItem) => !i.product_id && i.ten_sp)
      if (needLookup.length > 0) {
        const { data: matched } = await supabase
          .from('products').select('id, ten_sp').in('ten_sp', needLookup.map((i: InsertItem) => i.ten_sp))
        if (matched) {
          const byName: Record<string, number> = Object.fromEntries(matched.map((p: { id: number; ten_sp: string }) => [p.ten_sp, p.id]))
          itemsToInsert.forEach((i: InsertItem) => { if (!i.product_id && byName[i.ten_sp]) i.product_id = byName[i.ten_sp] })
        }
      }
      const { error: itemsErr } = await supabase.from('quote_items').insert(itemsToInsert)
      if (itemsErr) console.error('Insert quote_items:', itemsErr.message)
    }

    // Audit log
    const typeLabel = type === 'commercial' ? 'đơn TM' : type === 'project' ? 'hồ sơ dự án' : 'BG'
    void logAudit(supabase, {
      user_id:   user.id,
      user_name: profile.full_name,
      action:    'quote_created',
      entity:    'quote',
      detail:    `Tạo ${typeLabel} ${data.ma_bao_gia} cho KH ${data.customers?.ho_ten ?? 'N/A'} (v${data.phien_ban})`,
    })

    // Pipeline KH: chỉ advance khi BG đã gửi (PATCH → "Đã gửi"), không advance khi mới tạo Nháp

    return NextResponse.json({ data: mapQuote(data) }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/lark/quotes:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
