import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listAllRecords, createRecord, updateRecord } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'
import { mapQuote } from './_mappers'

// ─── Tạo mã báo giá tự động ──────────────────────────────────────────────────

function genMaBaoGia(): string {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const tail  = String(Date.now()).slice(-4)
  return `BG-${year}${month}-${tail}`
}

// ─── Lấy phiên bản tiếp theo cho khách hàng ──────────────────────────────────

async function nextVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerRecordId: string
): Promise<number> {
  const { data } = await supabase
    .from('quote_customer_links')
    .select('version')
    .eq('customer_record_id', customerRecordId)
    .order('version', { ascending: false })
    .limit(1)
  return (data?.[0]?.version ?? 0) + 1
}

// ─── GET /api/lark/quotes ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    // customer_record_id: lọc BG của 1 KH cụ thể (dùng từ trang Khách hàng)
    const customerId = req.nextUrl.searchParams.get('customer_record_id')

    let filter: string | undefined
    if (customerId) {
      // Tìm tất cả quote_record_id của KH này qua bảng link
      const { data: links } = await supabase
        .from('quote_customer_links')
        .select('quote_record_id')
        .eq('customer_record_id', customerId)
      const ids = (links ?? []).map(l => l.quote_record_id)
      if (ids.length === 0) return NextResponse.json({ data: [] })
      // Lark không support filter by record_id list → fetch all rồi filter phía server
      const all = await listAllRecords(TABLES.QUOTES)
      const filtered = all.filter(r => ids.includes(r.record_id)).map(mapQuote)
      return NextResponse.json({ data: filtered })
    }

    if (profile.role === 'sales') {
      filter = `CurrentValue.[Người phụ trách] = "${profile.full_name}"`
    }

    const records = await listAllRecords(TABLES.QUOTES, filter)
    return NextResponse.json({ data: records.map(mapQuote) })
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
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    if (!['admin', 'manager', 'sales'].includes(profile.role)) {
      return NextResponse.json({ error: 'Không có quyền tạo báo giá' }, { status: 403 })
    }

    const body = await req.json()
    const {
      khach_hang, sdt, san_pham, tong_gia_tri, chiet_khau,
      ghi_chu_ky_thuat, ghi_chu_thuong_mai, customer_record_id,
    } = body

    if (!khach_hang) {
      return NextResponse.json({ error: 'Tên khách hàng là bắt buộc' }, { status: 400 })
    }

    // Phiên bản tự tăng
    const phien_ban = customer_record_id
      ? await nextVersion(supabase, customer_record_id)
      : 1

    const ngayLap    = Date.now()
    const ngayHetHan = ngayLap + 14 * 86400000

    const fields: Record<string, unknown> = {
      'Mã báo giá':            genMaBaoGia(),
      'Khách hàng':            khach_hang,
      'SĐT':                   sdt || '',
      'Người phụ trách':       profile.full_name,
      'Phiên bản':             phien_ban,
      'Tổng giá trị BG (VNĐ)': Number(tong_gia_tri) || 0,
      'Chiết khấu (%)':        Number(chiet_khau) || 0,
      'Ngày lập BG':           ngayLap,
      'Ngày hết hạn BG':       ngayHetHan,
      'Trạng thái':            'Nháp',
    }
    if (san_pham)            fields['Sản phẩm đề xuất']  = san_pham
    if (ghi_chu_ky_thuat)    fields['Ghi chú kỹ thuật']  = ghi_chu_ky_thuat
    if (ghi_chu_thuong_mai)  fields['Ghi chú thương mại'] = ghi_chu_thuong_mai

    const record = await createRecord(TABLES.QUOTES, fields)

    // Lưu link quote ↔ customer + đẩy pipeline → "Báo giá"
    if (customer_record_id) {
      await supabase.from('quote_customer_links').insert({
        quote_record_id:    record.record_id,
        customer_record_id,
        version:            phien_ban,
      })
      await updateRecord(TABLES.CUSTOMERS, customer_record_id, {
        'Trạng thái pipeline': 'Báo giá',
      }).catch(() => {}) // non-blocking
    }

    return NextResponse.json({ data: mapQuote(record) }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/lark/quotes:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
