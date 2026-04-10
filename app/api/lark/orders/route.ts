import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createRecord } from '@/lib/lark/client'
import { cachedListAllRecords } from '@/lib/lark/cached'
import { TABLES } from '@/lib/lark/tables'
import { mappers } from './_mappers'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Contract {
  record_id: string
  ma_hd: string
  khach_hang: string
  sdt: string
  nguoi_phu_trach: string
  ngay_ky: number | null
  gia_tri_hd: number
  gia_tri_gws: number
  trang_thai: string
  san_pham: string[]
  dia_chi_ct: string
  hh_kinh_doanh: number
  ngay_giao_dk: number | null
  ghi_chu: string
}

export interface CommercialOrder {
  record_id: string
  ma_don: string
  ngay_dat: string
  loai_khach: string
  ten_kh: string
  sdt: string
  tinh_thanh: string
  san_pham: string
  ma_sp: string
  so_luong: number
  don_vi: string
  don_gia: number
  tong_tien: number
  phuong_thuc_tt: string
  ngay_giao_dk: number | null
  ngay_giao_thuc: number | null
  trang_thai: string
  nguoi_phu_trach: string
  ghi_chu: string
}

export interface Project {
  record_id: string
  ma_da: string
  ten_da: string
  chu_dau_tu: string
  tong_thau: string
  loai_da: string
  quy_mo: string
  tinh_thanh: string
  giai_doan: string
  gia_tri_dt: number
  gia_tri_hd: number
  ngay_bao_gia: number | null
  ngay_du_kien_ky: number | null
  ngay_bt_tc: number | null
  ngay_hoan_thanh: number | null
  nv_phu_trach: string
  doi_tac: string
  ty_le_thang: number
  cong_no: number
  ghi_chu: string
}

// ─── Route handlers ───────────────────────────────────────────────────────────

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

    const tab = req.nextUrl.searchParams.get('tab') ?? 'b2c'
    const isSalesRestricted = profile.role === 'sales'

    if (tab === 'b2c') {
      const filter = isSalesRestricted
        ? `CurrentValue.[Người phụ trách] = "${profile.full_name}"`
        : undefined
      const records = await cachedListAllRecords(TABLES.CONTRACTS, filter)
      return NextResponse.json({ data: records.map(mappers.contract) })
    }

    if (tab === 'commercial') {
      const filter = isSalesRestricted
        ? `CurrentValue.[Người phụ trách] = "${profile.full_name}"`
        : undefined
      const records = await cachedListAllRecords(TABLES.COMMERCIAL, filter)
      return NextResponse.json({ data: records.map(mappers.commercial) })
    }

    if (tab === 'projects') {
      const filter = isSalesRestricted
        ? `CurrentValue.[NV phụ trách] = "${profile.full_name}"`
        : undefined
      const records = await cachedListAllRecords(TABLES.PROJECTS, filter)
      return NextResponse.json({ data: records.map(mappers.project) })
    }

    return NextResponse.json({ error: 'Tab không hợp lệ' }, { status: 400 })
  } catch (err) {
    console.error('GET /api/lark/orders:', err)
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

    const tab = req.nextUrl.searchParams.get('tab') ?? 'b2c'
    const body = await req.json()

    if (tab === 'b2c') {
      const { ma_hd, khach_hang, sdt, san_pham, gia_tri_hd, dia_chi_ct, ngay_ky, ghi_chu } = body
      if (!khach_hang || !gia_tri_hd) {
        return NextResponse.json({ error: 'Tên KH và giá trị HĐ là bắt buộc' }, { status: 400 })
      }
      const fields: Record<string, unknown> = {
        'Mã HĐ':              ma_hd || '',
        'Khách hàng':         khach_hang,
        'SĐT':                sdt || '',
        'Người phụ trách':    profile.full_name,
        'Giá trị HĐ (VNĐ)':  Number(gia_tri_hd),
        'Giá trị GWS (VNĐ)': Number(gia_tri_hd),
        'Trạng thái HĐ':     'Đã ký - Chờ TT đợt 1',
      }
      if (dia_chi_ct) fields['Địa chỉ công trình'] = [dia_chi_ct]
      if (ngay_ky) fields['Ngày ký'] = new Date(ngay_ky).getTime()
      // Ghi tên SP vào Ghi chú (Sản phẩm chính là multi-select cố định trên Lark)
      const ghiChuFull = [san_pham ? `SP: ${san_pham}` : '', ghi_chu].filter(Boolean).join(' | ')
      if (ghiChuFull) fields['Ghi chú'] = ghiChuFull
      const record = await createRecord(TABLES.CONTRACTS, fields)

      // Lưu liên kết contract ↔ customer nếu có (dùng cho auto-update pipeline)
      if (body.customer_record_id) {
        await supabase.from('contract_customer_links').upsert({
          contract_record_id: record.record_id,
          customer_record_id: body.customer_record_id,
        })
      }

      revalidateTag('lark-contracts', 'max')
      return NextResponse.json({ data: mappers.contract(record) }, { status: 201 })
    }

    if (tab === 'commercial') {
      const { ten_kh, sdt, san_pham, so_luong, don_gia, loai_khach, tinh_thanh, phuong_thuc_tt, ghi_chu } = body
      if (!ten_kh || !san_pham || !so_luong || !don_gia) {
        return NextResponse.json({ error: 'Tên KH, sản phẩm, số lượng và đơn giá là bắt buộc' }, { status: 400 })
      }
      const tong_tien = Number(so_luong) * Number(don_gia)
      const fields: Record<string, unknown> = {
        'Ngày đặt':                new Date().toISOString().slice(0, 10),
        'Loại khách':              loai_khach || 'Đại lý cấp 1',
        'Tên khách hàng | Đại lý': ten_kh,
        'SĐT':                     sdt || '',
        'Sản phẩm | Vật tư':       san_pham,
        'Số lượng':                Number(so_luong),
        'Đơn giá (VNĐ)':           Number(don_gia),
        'Tổng tiền (VNĐ)':         Number(tong_tien),
        'Phương thức TT':          phuong_thuc_tt || 'Chuyển khoản',
        'Trạng thái đơn':          'Chờ xác nhận',
        'Người phụ trách':         profile.full_name,
      }
      if (tinh_thanh) fields['Tỉnh|Thành'] = tinh_thanh
      if (ghi_chu) fields['Ghi chú'] = ghi_chu
      const record = await createRecord(TABLES.COMMERCIAL, fields)
      revalidateTag('lark-commercial', 'max')
      return NextResponse.json({ data: mappers.commercial(record) }, { status: 201 })
    }

    if (tab === 'projects') {
      const { ten_da, chu_dau_tu, loai_da, quy_mo, tinh_thanh, gia_tri_dt, ty_le_thang, ghi_chu } = body
      if (!ten_da || !chu_dau_tu) {
        return NextResponse.json({ error: 'Tên dự án và chủ đầu tư là bắt buộc' }, { status: 400 })
      }
      const fields: Record<string, unknown> = {
        'Tên dự án':               ten_da,
        'Chủ đầu tư':              chu_dau_tu,
        'Giai đoạn dự án':         'Tìm hiểu',
        'NV phụ trách':            profile.full_name,
        'Ngày nộp thầu | Ngày báo giá': Date.now(),
      }
      if (loai_da) fields['Loại dự án'] = loai_da
      if (quy_mo) fields['Quy mô'] = quy_mo
      if (tinh_thanh) fields['Tỉnh|Thành'] = tinh_thanh
      if (gia_tri_dt) fields['Giá trị DT ước tính (VNĐ)'] = Number(gia_tri_dt)
      if (ty_le_thang) fields['Tỷ lệ thắng thầu (%)'] = Number(ty_le_thang)
      if (ghi_chu) fields['Ghi chú'] = ghi_chu
      const record = await createRecord(TABLES.PROJECTS, fields)
      revalidateTag('lark-projects', 'max')
      return NextResponse.json({ data: mappers.project(record) }, { status: 201 })
    }

    return NextResponse.json({ error: 'Tab không hợp lệ' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/lark/orders:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
