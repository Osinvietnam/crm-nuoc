export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecord, createRecord } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'
import { mapQuote } from '../_mappers'

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
      .from('profiles').select('full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    if (!['admin', 'manager', 'sales'].includes(profile.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const { source_record_id } = await req.json()
    if (!source_record_id) return NextResponse.json({ error: 'Thiếu source_record_id' }, { status: 400 })

    // Lấy BG gốc
    const source = await getRecord(TABLES.QUOTES, source_record_id)
    const f      = source.fields

    // Lấy customer link để tính version tiếp theo
    const { data: link } = await supabase
      .from('quote_customer_links')
      .select('customer_record_id, version')
      .eq('quote_record_id', source_record_id)
      .single()

    let nextVersion = 2
    if (link?.customer_record_id) {
      const { data: versions } = await supabase
        .from('quote_customer_links')
        .select('version')
        .eq('customer_record_id', link.customer_record_id)
        .order('version', { ascending: false })
        .limit(1)
      nextVersion = (versions?.[0]?.version ?? 1) + 1
    }

    const ngayLap    = Date.now()
    const ngayHetHan = ngayLap + 14 * 86400000

    const newFields: Record<string, unknown> = {
      'Mã báo giá':             genMaBaoGia(),
      'Khách hàng':             String(f['Khách hàng'] ?? ''),
      'SĐT':                    String(f['SĐT'] ?? ''),
      'Người phụ trách':        profile.full_name,
      'Phiên bản':              nextVersion,
      'Sản phẩm đề xuất':      f['Sản phẩm đề xuất'] ?? '',
      'Tổng giá trị BG (VNĐ)': Number(f['Tổng giá trị BG (VNĐ)'] ?? 0),
      'Chiết khấu (%)':         Number(f['Chiết khấu (%)'] ?? 0),
      'Ngày lập BG':            ngayLap,
      'Ngày hết hạn BG':        ngayHetHan,
      'Trạng thái':             'Nháp',
    }
    // Copy ghi chú
    if (f['Ghi chú kỹ thuật'])   newFields['Ghi chú kỹ thuật']   = f['Ghi chú kỹ thuật']
    if (f['Ghi chú thương mại']) newFields['Ghi chú thương mại'] = f['Ghi chú thương mại']

    const newRecord = await createRecord(TABLES.QUOTES, newFields)

    // Lưu link mới
    if (link?.customer_record_id) {
      await supabase.from('quote_customer_links').insert({
        quote_record_id:    newRecord.record_id,
        customer_record_id: link.customer_record_id,
        version:            nextVersion,
      })
    }

    return NextResponse.json({ data: mapQuote(newRecord) }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/lark/quotes/duplicate:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
