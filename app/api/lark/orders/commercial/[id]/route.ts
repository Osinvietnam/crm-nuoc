import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecord, updateRecord } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'
import { mappers } from '../../_mappers'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const record = await getRecord(TABLES.COMMERCIAL, id)
    return NextResponse.json({ data: mappers.commercial(record) })
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

    if (body.trang_thai !== undefined)    fields['Trạng thái đơn'] = body.trang_thai
    if (body.ghi_chu !== undefined)       fields['Ghi chú'] = body.ghi_chu
    if (body.ngay_giao_thuc !== undefined) fields['Ngày giao thực'] = body.ngay_giao_thuc

    const record = await updateRecord(TABLES.COMMERCIAL, id, fields)
    return NextResponse.json({ data: mappers.commercial(record) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
