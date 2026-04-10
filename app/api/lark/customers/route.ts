import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRecord, LarkRecord } from '@/lib/lark/client'
import { cachedListAllRecords, invalidateCache } from '@/lib/lark/cached'
import { TABLES } from '@/lib/lark/tables'

export interface Customer {
  record_id: string
  ho_ten: string
  sdt: string
  sdt_khac: string
  email: string
  ma_kh: string
  dia_chi_hd: string
  dia_chi_ct: string
  pipeline: string
  nguoi_phu_trach: string
  nguon_kh: string
  doi_tac_gt: string
  loai_hinh_nha: string
  nguon_nuoc: string
  san_pham_quan_tam: string[]
  bao_gia: number
  muc_uu_tien: string
  ngay_lien_he_dau: number | null
  ngay_cap_nhat: number | null
  noi_dung: string
  ly_do_tu_choi: string
  nhom_dv: string
  tien_do_ct: string
  khu_vuc: string
}

function mapRecord(r: LarkRecord): Customer {
  const f = r.fields
  return {
    record_id:       r.record_id,
    ho_ten:          String(f['Họ tên KH'] ?? ''),
    sdt:             String(f['SĐT di động'] ?? ''),
    sdt_khac:        String(f['SĐT khác'] ?? ''),
    email:           String(f['Email'] ?? ''),
    ma_kh:           String(f['Mã KH (tự đặt)'] ?? ''),
    dia_chi_hd:      String(f['Địa chỉ ký HĐ'] ?? ''),
    dia_chi_ct:      String(f['Địa chỉ công trình'] ?? ''),
    pipeline:        String(f['Trạng thái pipeline'] ?? ''),
    nguoi_phu_trach: String(f['Người phụ trách'] ?? ''),
    nguon_kh:        String(f['Nguồn KH'] ?? ''),
    doi_tac_gt:      String(f['Đối tác giới thiệu'] ?? ''),
    loai_hinh_nha:   String(f['Loại hình nhà'] ?? ''),
    nguon_nuoc:      String(f['Nguồn nước'] ?? ''),
    san_pham_quan_tam: Array.isArray(f['Sản phẩm quan tâm'])
      ? (f['Sản phẩm quan tâm'] as string[])
      : [],
    bao_gia:          Number(f['Giá trị báo giá (VNĐ)'] ?? 0),
    muc_uu_tien:      String(f['Mức ưu tiên'] ?? ''),
    ngay_lien_he_dau: f['Ngày liên hệ đầu'] ? Number(f['Ngày liên hệ đầu']) : null,
    ngay_cap_nhat:    f['Ngày cập nhật cuối'] ? Number(f['Ngày cập nhật cuối']) : null,
    noi_dung:         String(f['Nội dung trao đổi'] ?? ''),
    ly_do_tu_choi:    String(f['Lý do từ chối'] ?? ''),
    nhom_dv:          String(f['Nhóm dịch vụ'] ?? ''),
    tien_do_ct:       String(f['Tiến độ công trình'] ?? ''),
    khu_vuc:          String(f['Khu vực'] ?? ''),
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role, khu_vuc')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    // Build filter for restricted roles
    let filter: string | undefined
    if (profile.role === 'sales' || profile.role === 'partner') {
      filter = `CurrentValue.[Người phụ trách] = "${profile.full_name}"`
    }

    const records = await cachedListAllRecords(TABLES.CUSTOMERS, filter)
    let customers = records.map(mapRecord)

    // Accountant: filter by their assigned region (if set)
    if (profile.role === 'accountant' && profile.khu_vuc) {
      customers = customers.filter(c => c.khu_vuc === profile.khu_vuc)
    }

    return NextResponse.json({ customers, role: profile.role })
  } catch (err) {
    console.error('GET /api/lark/customers:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

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

    const body = await req.json()
    const {
      ho_ten, sdt, sdt_khac, email, dia_chi_hd, dia_chi_ct,
      pipeline, nguoi_phu_trach, nguon_kh, doi_tac_gt,
      loai_hinh_nha, nguon_nuoc, san_pham_quan_tam,
      bao_gia, muc_uu_tien, noi_dung, nhom_dv, khu_vuc,
    } = body

    if (!ho_ten || !sdt) {
      return NextResponse.json({ error: 'Họ tên và SĐT là bắt buộc' }, { status: 400 })
    }

    // Sales/partner: force nguoi_phu_trach = themselves; others can assign freely
    const assignee = (profile.role === 'sales' || profile.role === 'partner')
      ? profile.full_name
      : (nguoi_phu_trach || profile.full_name)

    const fields: Record<string, unknown> = {
      'Họ tên KH':          ho_ten,
      'SĐT di động':        sdt,
      'Trạng thái pipeline': pipeline || 'Lead mới',
      'Người phụ trách':    assignee,
      'Ngày liên hệ đầu':   Date.now(),
      'Ngày cập nhật cuối': new Date().toISOString().slice(0, 10),
    }

    if (sdt_khac)           fields['SĐT khác'] = sdt_khac
    if (email)              fields['Email'] = email
    if (dia_chi_hd)         fields['Địa chỉ ký HĐ'] = dia_chi_hd
    if (dia_chi_ct)         fields['Địa chỉ công trình'] = dia_chi_ct
    if (nguon_kh)           fields['Nguồn KH'] = nguon_kh
    if (doi_tac_gt)         fields['Đối tác giới thiệu'] = doi_tac_gt
    if (loai_hinh_nha)      fields['Loại hình nhà'] = loai_hinh_nha
    if (nguon_nuoc)         fields['Nguồn nước'] = nguon_nuoc
    if (san_pham_quan_tam?.length) fields['Sản phẩm quan tâm'] = san_pham_quan_tam
    if (bao_gia)            fields['Giá trị báo giá (VNĐ)'] = String(bao_gia)
    if (muc_uu_tien)        fields['Mức ưu tiên'] = muc_uu_tien
    if (noi_dung)           fields['Nội dung trao đổi'] = noi_dung
    if (nhom_dv)            fields['Nhóm dịch vụ'] = nhom_dv
    if (khu_vuc)            fields['Khu vực'] = khu_vuc

    const record = await createRecord(TABLES.CUSTOMERS, fields)
    invalidateCache(TABLES.CUSTOMERS)
    return NextResponse.json({ customer: mapRecord(record) }, { status: 201 })
  } catch (err) {
    console.error('POST /api/lark/customers:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
