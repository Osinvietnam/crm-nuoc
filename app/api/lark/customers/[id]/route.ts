export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecord, updateRecord } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const record = await getRecord(TABLES.CUSTOMERS, id)
    return NextResponse.json({ record })
  } catch (err) {
    console.error('GET /api/lark/customers/[id]:', err)
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

    // Build fields to update (only pass what's provided)
    const fields: Record<string, unknown> = {}
    const fieldMap: Record<string, string> = {
      ho_ten:           'Họ tên KH',
      sdt:              'SĐT di động',
      sdt_khac:         'SĐT khác',
      email:            'Email',
      dia_chi_hd:       'Địa chỉ ký HĐ',
      dia_chi_ct:       'Địa chỉ công trình',
      pipeline:         'Trạng thái pipeline',
      nguoi_phu_trach:  'Người phụ trách',
      nguon_kh:         'Nguồn KH',
      doi_tac_gt:       'Đối tác giới thiệu',
      loai_hinh_nha:    'Loại hình nhà',
      nguon_nuoc:       'Nguồn nước',
      bao_gia:          'Giá trị báo giá (VNĐ)',
      muc_uu_tien:      'Mức ưu tiên',
      noi_dung:         'Nội dung trao đổi',
      ly_do_tu_choi:    'Lý do từ chối',
      nhom_dv:          'Nhóm dịch vụ',
      tien_do_ct:       'Tiến độ công trình',
    }

    for (const [key, larkField] of Object.entries(fieldMap)) {
      if (key in body) {
        fields[larkField] = key === 'bao_gia' ? String(body[key]) : body[key]
      }
    }

    if (body.san_pham_quan_tam !== undefined) {
      fields['Sản phẩm quan tâm'] = body.san_pham_quan_tam
    }

    // Always update last modified date
    fields['Ngày cập nhật cuối'] = new Date().toISOString().slice(0, 10)

    const record = await updateRecord(TABLES.CUSTOMERS, id, fields)
    return NextResponse.json({ record })
  } catch (err) {
    console.error('PATCH /api/lark/customers/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
