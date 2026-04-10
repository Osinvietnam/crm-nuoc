import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecord, updateRecord, createRecord, type LarkRecord } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'
import { mappers } from '../../_mappers'

type Supabase = Awaited<ReturnType<typeof createClient>>

async function syncCustomerPipeline(supabase: Supabase, contractId: string) {
  const { data } = await supabase
    .from('contract_customer_links')
    .select('customer_record_id')
    .eq('contract_record_id', contractId)
    .single()
  if (!data?.customer_record_id) return
  await updateRecord(TABLES.CUSTOMERS, data.customer_record_id, {
    'Trạng thái pipeline': 'Bảo hành',
  })
}

// Q4: HĐ "Đang thi công" → tự tạo bản ghi TB07 (Công trình)
async function autoCreateConstruction(supabase: Supabase, contractRecord: LarkRecord, contractId: string) {
  // Dedup: chỉ tạo một lần
  const { data: existing } = await supabase
    .from('construction_contract_links')
    .select('construction_record_id')
    .eq('contract_record_id', contractId)
    .single()
  if (existing?.construction_record_id) return

  const f = contractRecord.fields
  const spArr = f['Sản phẩm chính']
  const san_pham = Array.isArray(spArr) ? String(spArr[0] ?? '') : String(spArr ?? '')
  const diaChiRaw = f['Địa chỉ công trình']
  const dia_chi = Array.isArray(diaChiRaw)
    ? (diaChiRaw as string[]).join(', ')
    : String(diaChiRaw ?? '')

  const construction = await createRecord(TABLES.CONSTRUCTION, {
    'Khách hàng':          String(f['Khách hàng'] ?? ''),
    'SĐT đại diện':        String(f['SĐT'] ?? ''),
    'Địa chỉ công trình':  dia_chi,
    'Trạng thái thi công': 'Đang thi công',
  })

  // Lấy customer_record_id (nếu có) để dùng ở Q5
  const { data: custLink } = await supabase
    .from('contract_customer_links')
    .select('customer_record_id')
    .eq('contract_record_id', contractId)
    .single()

  await supabase.from('construction_contract_links').insert({
    contract_record_id:     contractId,
    construction_record_id: construction.record_id,
    customer_record_id:     custLink?.customer_record_id ?? null,
  })
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
    const record = await getRecord(TABLES.CONTRACTS, id)
    return NextResponse.json({ data: mappers.contract(record) })
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

    if (body.trang_thai !== undefined) fields['Trạng thái HĐ'] = body.trang_thai
    if (body.ghi_chu !== undefined)    fields['Ghi chú'] = body.ghi_chu

    const record = await updateRecord(TABLES.CONTRACTS, id, fields)

    // Q4: HĐ Đang thi công → tự tạo TB07 (Công trình)
    if (body.trang_thai === 'Đang thi công') {
      await autoCreateConstruction(supabase, record, id).catch(e => console.error('autoCreateConstruction:', e))
    }

    // Q3: HĐ Hoàn thành → tự chuyển pipeline KH sang Bảo hành
    if (body.trang_thai === 'Hoàn thành') {
      await syncCustomerPipeline(supabase, id).catch(e => console.error('syncPipeline:', e))
    }

    return NextResponse.json({ data: mappers.contract(record) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
