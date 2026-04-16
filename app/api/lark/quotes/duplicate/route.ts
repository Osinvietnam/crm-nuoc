import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapQuote } from '../_mappers'
import { logAudit } from '@/lib/audit'

function genMaBaoGia(): string {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const tail  = String(Date.now()).slice(-4)
  return `BG-${year}${month}-${tail}`
}

// POST /api/lark/quotes/duplicate
// body: { source_record_id: string }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    if (!['admin', 'ceo', 'sales'].includes(profile.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const { source_record_id } = await req.json()
    if (!source_record_id) return NextResponse.json({ error: 'Thiếu source_record_id' }, { status: 400 })

    const sourceId = Number(source_record_id)

    // Lấy BG gốc từ Supabase
    const { data: source, error: srcErr } = await supabase
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('id', sourceId)
      .single()
    if (srcErr || !source) return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 })

    // Tính version tiếp theo theo customer
    let nextVersion = 2
    if (source.customer_id) {
      const { data: versions } = await supabase
        .from('quotes')
        .select('phien_ban')
        .eq('customer_id', source.customer_id)
        .order('phien_ban', { ascending: false })
        .limit(1)
      nextVersion = (versions?.[0]?.phien_ban ?? 1) + 1
    }

    const today     = new Date()
    const ngayLap   = today.toISOString().slice(0, 10)
    const deadline  = new Date(today.getTime() + 14 * 86400000)
    const ngayHetHan = deadline.toISOString().slice(0, 10)

    // Tạo BG mới trong Supabase
    const { data: newQuote, error: insertErr } = await supabase
      .from('quotes')
      .insert({
        ma_bao_gia:         genMaBaoGia(),
        nguoi_phu_trach:    profile.id,
        phien_ban:          nextVersion,
        san_pham:           source.san_pham ?? [],
        tong_gia_tri:       source.tong_gia_tri ?? 0,
        chiet_khau:         source.chiet_khau ?? 0,
        gia_tri_sau_ck:     source.gia_tri_sau_ck ?? 0,
        ngay_lap:           ngayLap,
        ngay_het_han:       ngayHetHan,
        kenh_tiep_nhan:     source.kenh_tiep_nhan ?? null,
        ghi_chu_ky_thuat:   source.ghi_chu_ky_thuat ?? null,
        ghi_chu_thuong_mai: source.ghi_chu_thuong_mai ?? null,
        trang_thai:         'Nháp',
        customer_id:        source.customer_id ?? null,
      })
      .select('*, staff:nguoi_phu_trach(id, full_name), customers!customer_id(id, ho_ten, sdt)')
      .single()

    if (insertErr || !newQuote) {
      console.error('POST /api/lark/quotes/duplicate insert:', insertErr)
      return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
    }

    // Sao chép quote_items nếu có
    if (source.quote_items?.length) {
      const itemsToInsert = source.quote_items.map((item: any) => ({
        quote_id:     newQuote.id,
        product_id:   item.product_id ?? null,
        ten_sp:       item.ten_sp,
        so_luong:     item.so_luong,
        don_gia:      item.don_gia,
      }))
      await supabase.from('quote_items').insert(itemsToInsert)
    }

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: profile.full_name,
      action:    'quote_duplicated',
      entity:    'quote',
      detail:    `Duplicate BG ${source.ma_bao_gia} → ${newQuote.ma_bao_gia} (v${nextVersion})`,
    })
    return NextResponse.json({ data: mapQuote(newQuote) }, { status: 201 })
  } catch (err) {
    console.error('POST /api/lark/quotes/duplicate:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
