// Quote interface — record_id = Supabase id.toString()

export interface Quote {
  record_id:           string
  ma_bao_gia:          string
  khach_hang:          string
  sdt:                 string
  dia_chi_ct:          string   // Địa chỉ công trình từ KH (dùng để pre-fill HĐ)
  nguoi_phu_trach:     string   // full_name
  phien_ban:           number
  san_pham:            string[]
  tong_gia_tri:        number
  chiet_khau:          number
  gia_tri_sau_ck:      number
  ngay_lap:            number | null  // ms timestamp (UI compat)
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
  customer_id:         number | null
}

function toMs(d: string | null | undefined): number | null {
  if (!d) return null
  const ms = new Date(d).getTime()
  return isNaN(ms) ? null : ms
}

export function mapQuote(r: any): Quote {
  const tong = r.tong_gia_tri ?? 0
  const ck   = r.chiet_khau  ?? 0
  return {
    record_id:          r.id?.toString() ?? '',
    ma_bao_gia:         r.ma_bao_gia          ?? '',
    khach_hang:         r.customers?.ho_ten   ?? '',
    sdt:                r.sdt                 ?? '',
    dia_chi_ct:         r.customers?.dia_chi_ct ?? r.customers?.dia_chi_hd ?? '',
    nguoi_phu_trach:    r.staff?.full_name    ?? '',
    phien_ban:          r.phien_ban           ?? 1,
    san_pham:           r.san_pham            ?? [],
    tong_gia_tri:       tong,
    chiet_khau:         ck,
    gia_tri_sau_ck:     r.gia_tri_sau_ck      ?? Math.round(tong * (1 - ck / 100)),
    ngay_lap:           toMs(r.ngay_lap),
    ngay_het_han:       toMs(r.ngay_het_han),
    ngay_gui_kh:        toMs(r.ngay_gui_kh),
    kenh_tiep_nhan:     r.kenh_tiep_nhan      ?? '',
    ngay_follow_up:     toMs(r.ngay_follow_up),
    ket_qua_follow_up:  r.ket_qua_follow_up   ?? '',
    trang_thai:         r.trang_thai          ?? '',
    ly_do_tu_choi:      r.ly_do_tu_choi       ?? '',
    ma_hd_tham_chieu:   r.ma_hd_tham_chieu    ?? '',
    ghi_chu_ky_thuat:   r.ghi_chu_ky_thuat    ?? '',
    ghi_chu_thuong_mai: r.ghi_chu_thuong_mai  ?? '',
    customer_id:        r.customer_id         ?? null,
  }
}
