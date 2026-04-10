export const dynamic = 'force-dynamic'
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
    const record = await getRecord(TABLES.PROJECTS, id)
    return NextResponse.json({ data: mappers.project(record) })
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

    if (body.giai_doan !== undefined)    fields['Giai đoạn dự án'] = body.giai_doan
    if (body.ghi_chu !== undefined)      fields['Ghi chú'] = body.ghi_chu
    if (body.ty_le_thang !== undefined)  fields['Tỷ lệ thắng thầu (%)'] = String(body.ty_le_thang)
    if (body.gia_tri_hd !== undefined)   fields['Giá trị HĐ ký (VNĐ)'] = String(body.gia_tri_hd)
    if (body.cong_no !== undefined)      fields['Công nợ còn lại (VNĐ)'] = String(body.cong_no)

    const record = await updateRecord(TABLES.PROJECTS, id, fields)
    return NextResponse.json({ data: mappers.project(record) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
