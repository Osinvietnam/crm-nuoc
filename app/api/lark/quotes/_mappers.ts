import type { LarkRecord } from '@/lib/lark/client'

export interface Quote {
  record_id:           string
  ma_bao_gia:          string
  khach_hang:          string
  sdt:                 string
  nguoi_phu_trach:     string
  phien_ban:           number
  san_pham:            string[]
  tong_gia_tri:        number
  chiet_khau:          number
  gia_tri_sau_ck:      number   // computed
  ngay_lap:            number | null
  ngay_het_han:        number | null
  ngay_gui_kh:         number | null
  kenh_tiep_nhan:      string
  ngay_follow_up:      number | null
  ket_qua_follow_up:   string
  trang_thai:          string
  ly_do_tu_choi:       string
  ma_hd_tham_chieu:    string
  ghi_chu_ky_thuat:    string
  ghi_chu_thuong_mai:  string
}

export function mapQuote(r: LarkRecord): Quote {
  const f = r.fields
  const tong    = Number(f['Tổng giá trị BG (VNĐ)'] ?? 0)
  const ck      = Number(f['Chiết khấu (%)'] ?? 0)
  const spRaw   = f['Sản phẩm đề xuất']
  const sanPham = spRaw
    ? String(spRaw).split(',').map(s => s.trim()).filter(Boolean)
    : []

  return {
    record_id:          r.record_id,
    ma_bao_gia:         String(f['Mã báo giá'] ?? ''),
    khach_hang:         String(f['Khách hàng'] ?? ''),
    sdt:                String(f['SĐT'] ?? ''),
    nguoi_phu_trach:    String(f['Người phụ trách'] ?? ''),
    phien_ban:          Number(f['Phiên bản'] ?? 1),
    san_pham:           sanPham,
    tong_gia_tri:       tong,
    chiet_khau:         ck,
    gia_tri_sau_ck:     Math.round(tong * (1 - ck / 100)),
    ngay_lap:           f['Ngày lập BG']     ? Number(f['Ngày lập BG'])     : null,
    ngay_het_han:       f['Ngày hết hạn BG'] ? Number(f['Ngày hết hạn BG']) : null,
    ngay_gui_kh:        f['Ngày gửi KH']     ? Number(f['Ngày gửi KH'])     : null,
    kenh_tiep_nhan:     String(f['Nguồn KH'] ?? ''),
    ngay_follow_up:     f['Ngày follow-up']  ? Number(f['Ngày follow-up'])  : null,
    ket_qua_follow_up:  String(f['Kết quả follow-up'] ?? ''),
    trang_thai:         String(f['Trạng thái'] ?? ''),
    ly_do_tu_choi:      String(f['Lý do từ chối'] ?? ''),
    ma_hd_tham_chieu:   String(f['Mã HĐ tham chiếu'] ?? ''),
    ghi_chu_ky_thuat:   String(f['Ghi chú kỹ thuật'] ?? ''),
    ghi_chu_thuong_mai: String(f['Ghi chú thương mại'] ?? ''),
  }
}
