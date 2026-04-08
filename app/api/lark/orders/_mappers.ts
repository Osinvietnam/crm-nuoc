import type { LarkRecord } from '@/lib/lark/client'
import type { Contract, CommercialOrder, Project } from './route'

function mapContract(r: LarkRecord): Contract {
  const f = r.fields
  const sp = f['Sản phẩm chính']
  return {
    record_id:       r.record_id,
    ma_hd:           String(f['Mã HĐ'] ?? ''),
    khach_hang:      String(f['Khách hàng'] ?? ''),
    sdt:             String(f['SĐT'] ?? ''),
    nguoi_phu_trach: String(f['Người phụ trách'] ?? ''),
    ngay_ky:         f['Ngày ký'] ? Number(f['Ngày ký']) : null,
    gia_tri_hd:      Number(f['Giá trị HĐ (VNĐ)'] ?? 0),
    gia_tri_gws:     Number(f['Giá trị GWS (VNĐ)'] ?? 0),
    trang_thai:      String(f['Trạng thái HĐ'] ?? ''),
    san_pham:        Array.isArray(sp) ? sp as string[] : sp ? [String(sp)] : [],
    dia_chi_ct:      Array.isArray(f['Địa chỉ công trình'])
      ? (f['Địa chỉ công trình'] as string[]).join(', ')
      : String(f['Địa chỉ công trình'] ?? ''),
    hh_kinh_doanh:  Number(f['HH kinh doanh (VNĐ)'] ?? 0),
    ngay_giao_dk:   f['Ngày giao hàng DK'] ? Number(f['Ngày giao hàng DK']) : null,
    ghi_chu:         String(f['Ghi chú'] ?? ''),
  }
}

function mapCommercial(r: LarkRecord): CommercialOrder {
  const f = r.fields
  return {
    record_id:       r.record_id,
    ma_don:          String(f['Mã đơn hàng'] ?? ''),
    ngay_dat:        String(f['Ngày đặt'] ?? ''),
    loai_khach:      String(f['Loại khách'] ?? ''),
    ten_kh:          String(f['Tên khách hàng | Đại lý'] ?? ''),
    sdt:             String(f['SĐT'] ?? ''),
    tinh_thanh:      String(f['Tỉnh|Thành'] ?? ''),
    san_pham:        String(f['Sản phẩm | Vật tư'] ?? ''),
    ma_sp:           String(f['Mã SP|VT'] ?? ''),
    so_luong:        Number(f['Số lượng'] ?? 0),
    don_vi:          String(f['Đơn vị'] ?? ''),
    don_gia:         Number(f['Đơn giá (VNĐ)'] ?? 0),
    tong_tien:       Number(f['Tổng tiền (VNĐ)'] ?? 0),
    phuong_thuc_tt:  String(f['Phương thức TT'] ?? ''),
    ngay_giao_dk:    f['Ngày giao hàng DK'] ? Number(f['Ngày giao hàng DK']) : null,
    ngay_giao_thuc:  f['Ngày giao thực'] ? Number(f['Ngày giao thực']) : null,
    trang_thai:      String(f['Trạng thái đơn'] ?? ''),
    nguoi_phu_trach: String(f['Người phụ trách'] ?? ''),
    ghi_chu:         String(f['Ghi chú'] ?? ''),
  }
}

function mapProject(r: LarkRecord): Project {
  const f = r.fields
  return {
    record_id:       r.record_id,
    ma_da:           String(f['Mã dự án'] ?? ''),
    ten_da:          String(f['Tên dự án'] ?? ''),
    chu_dau_tu:      String(f['Chủ đầu tư'] ?? ''),
    tong_thau:       String(f['Tổng thầu | Đơn vị mời thầu'] ?? ''),
    loai_da:         String(f['Loại dự án'] ?? ''),
    quy_mo:          String(f['Quy mô'] ?? ''),
    tinh_thanh:      String(f['Tỉnh|Thành'] ?? ''),
    giai_doan:       String(f['Giai đoạn dự án'] ?? ''),
    gia_tri_dt:      Number(f['Giá trị DT ước tính (VNĐ)'] ?? 0),
    gia_tri_hd:      Number(f['Giá trị HĐ ký (VNĐ)'] ?? 0),
    ngay_bao_gia:    f['Ngày nộp thầu | Ngày báo giá'] ? Number(f['Ngày nộp thầu | Ngày báo giá']) : null,
    ngay_du_kien_ky: f['Ngày dự kiến ký HĐ'] ? Number(f['Ngày dự kiến ký HĐ']) : null,
    ngay_bt_tc:      f['Ngày bắt đầu TC'] ? Number(f['Ngày bắt đầu TC']) : null,
    ngay_hoan_thanh: f['Ngày hoàn thành DK'] ? Number(f['Ngày hoàn thành DK']) : null,
    nv_phu_trach:    String(f['NV phụ trách'] ?? ''),
    doi_tac:         String(f['Đối tác tham gia'] ?? ''),
    ty_le_thang:     Number(f['Tỷ lệ thắng thầu (%)'] ?? 0),
    cong_no:         Number(f['Công nợ còn lại (VNĐ)'] ?? 0),
    ghi_chu:         String(f['Ghi chú'] ?? ''),
  }
}

export const mappers = { contract: mapContract, commercial: mapCommercial, project: mapProject }
