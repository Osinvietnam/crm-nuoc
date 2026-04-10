import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecord, updateRecord, createRecord, type LarkRecord } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'
import { mappers } from '../../_mappers'

type Supabase = Awaited<ReturnType<typeof createClient>>

// Q5: CT "Đã nghiệm thu" → tự tạo bản ghi TB11 (Bảo dưỡng định kỳ)
async function autoCreatePeriodic(supabase: Supabase, constructionRecord: LarkRecord, constructionId: string) {
  // Dedup: chỉ tạo một lần
  const { data: link } = await supabase
    .from('construction_contract_links')
    .select('customer_record_id, periodic_service_created')
    .eq('construction_record_id', constructionId)
    .single()
  if (link?.periodic_service_created) return

  const f = constructionRecord.fields

  const fields: Record<string, unknown> = {
    'Khách hàng':     String(f['Khách hàng'] ?? ''),
    'SĐT':            String(f['SĐT đại diện'] ?? ''),
    'Chu kỳ (tháng)': 6,
    'Trạng thái':     'Chờ xác nhận',
  }

  await createRecord(TABLES.PERIODIC_SERVICE, fields)

  // Đánh dấu đã tạo TB11 (nếu link tồn tại; CT tạo từ app)
  if (link) {
    await supabase
      .from('construction_contract_links')
      .update({ periodic_service_created: true })
      .eq('construction_record_id', constructionId)
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const record = await getRecord(TABLES.CONSTRUCTION, id)
    return NextResponse.json({ data: mappers.construction(record) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const fields: Record<string, unknown> = {}

    if (body.trang_thai !== undefined)   fields['Trạng thái thi công'] = body.trang_thai
    if (body.ghi_chu !== undefined)      fields['Ghi chú thi công'] = body.ghi_chu
    if (body.ngay_nt !== undefined)      fields['Ngày NT'] = body.ngay_nt
    if (body.ngay_gh_thuc !== undefined) fields['Ngày GH thực'] = body.ngay_gh_thuc

    const record = await updateRecord(TABLES.CONSTRUCTION, id, fields)

    // Q5: CT Nghiệm thu hoàn thành → tự tạo TB11 (Bảo dưỡng định kỳ)
    if (body.trang_thai === 'Nghiệm thu hoàn thành') {
      await autoCreatePeriodic(supabase, record, id).catch(e => console.error('autoCreatePeriodic:', e))
    }

    return NextResponse.json({ data: mappers.construction(record) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
