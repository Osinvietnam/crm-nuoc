export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecord, updateRecord } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'
import { mapQuote } from '../_mappers'

type Supabase = Awaited<ReturnType<typeof createClient>>

// Khi BG được chấp nhận / từ chối → tự cập nhật pipeline TB01
async function syncCustomerPipeline(
  supabase: Supabase,
  quoteId: string,
  newPipelineStage: string
) {
  const { data } = await supabase
    .from('quote_customer_links')
    .select('customer_record_id')
    .eq('quote_record_id', quoteId)
    .single()
  if (!data?.customer_record_id) return

  const { updateRecord: update } = await import('@/lib/lark/client')
  await update(TABLES.CUSTOMERS, data.customer_record_id, {
    'Trạng thái pipeline': newPipelineStage,
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
    const record = await getRecord(TABLES.QUOTES, id)
    return NextResponse.json({ data: mapQuote(record) })
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

    if (body.trang_thai          !== undefined) fields['Trạng thái']            = body.trang_thai
    if (body.ly_do_tu_choi       !== undefined) fields['Lý do từ chối']         = body.ly_do_tu_choi
    if (body.ma_hd_tham_chieu    !== undefined) fields['Mã HĐ tham chiếu']      = body.ma_hd_tham_chieu
    if (body.tong_gia_tri        !== undefined) fields['Tổng giá trị BG (VNĐ)'] = Number(body.tong_gia_tri)
    if (body.chiet_khau          !== undefined) fields['Chiết khấu (%)']         = Number(body.chiet_khau)
    if (body.san_pham            !== undefined) fields['Sản phẩm đề xuất']      = body.san_pham
    if (body.ghi_chu_ky_thuat    !== undefined) fields['Ghi chú kỹ thuật']      = body.ghi_chu_ky_thuat
    if (body.ghi_chu_thuong_mai  !== undefined) fields['Ghi chú thương mại']    = body.ghi_chu_thuong_mai
    if (body.ngay_gui_kh         !== undefined) fields['Ngày gửi KH']       = body.ngay_gui_kh   === null ? null : Number(body.ngay_gui_kh)
    if (body.kenh_tiep_nhan      !== undefined) fields['Nguồn KH']           = body.kenh_tiep_nhan
    if (body.ngay_follow_up      !== undefined) fields['Ngày follow-up']    = body.ngay_follow_up === null ? null : Number(body.ngay_follow_up)
    if (body.ket_qua_follow_up   !== undefined) fields['Kết quả follow-up'] = body.ket_qua_follow_up

    const record = await updateRecord(TABLES.QUOTES, id, fields)

    // Automation: Chấp nhận → pipeline KH → "Chốt HĐ"
    if (body.trang_thai === 'Chấp nhận') {
      await syncCustomerPipeline(supabase, id, 'Chốt HĐ')
        .catch(e => console.error('syncPipeline (Chấp nhận):', e))
    }

    // Automation: Từ chối → pipeline KH → "Đàm phán"
    if (body.trang_thai === 'Từ chối') {
      await syncCustomerPipeline(supabase, id, 'Đàm phán')
        .catch(e => console.error('syncPipeline (Từ chối):', e))
    }

    return NextResponse.json({ data: mapQuote(record) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
