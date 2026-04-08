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
    const record = await getRecord(TABLES.PERIODIC_SERVICE, id)
    return NextResponse.json({ data: mappers.periodic(record) })
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

    if (body.trang_thai !== undefined)        fields['Trạng thái'] = body.trang_thai
    if (body.ghi_chu !== undefined)           fields['Ghi chú'] = body.ghi_chu
    // Đánh dấu hoàn thành: cập nhật lần BĐ gần nhất + tính lần tiếp theo
    if (body.lan_bd_gan_nhat !== undefined)   fields['Lần BĐ gần nhất'] = body.lan_bd_gan_nhat
    if (body.lan_bd_tiep_theo !== undefined)  fields['Lần BĐ tiếp theo'] = body.lan_bd_tiep_theo

    const record = await updateRecord(TABLES.PERIODIC_SERVICE, id, fields)
    return NextResponse.json({ data: mappers.periodic(record) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
