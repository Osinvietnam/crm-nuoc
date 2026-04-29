// Orders interfaces — record_id = Supabase id.toString()
// Reads from unified `orders` table with type = 'b2c' | 'commercial' | 'project'

function toMs(d: string | null | undefined): number | null {
  if (!d) return null
  const ms = new Date(d).getTime()
  return isNaN(ms) ? null : ms
}

export interface Contract {
  record_id:       string
  ma_hd:           string
  khach_hang:      string
  sdt:             string
  nguoi_phu_trach: string
  ngay_ky:         number | null
  gia_tri_hd:      number
  gia_tri_gws:     number
  trang_thai:      string
  san_pham:        string[]
  dia_chi_ct:      string
  hh_kinh_doanh:   number
  ngay_giao_dk:    number | null
  ghi_chu:         string
  customer_id:     number | null
}

export interface CommercialOrder {
  record_id:       string
  ma_don:          string
  ngay_dat:        number | null
  loai_khach:      string
  ten_kh:          string
  sdt:             string
  tinh_thanh:      string
  san_pham:        string
  ma_sp:           string
  so_luong:        number
  don_vi:          string
  don_gia:         number
  tong_tien:       number
  phuong_thuc_tt:  string
  ngay_giao_dk:    number | null
  ngay_giao_thuc:  number | null
  trang_thai:      string
  nguoi_phu_trach: string
  ghi_chu:         string
  dia_chi:         string
  customer_id:     number | null
}

export interface Project {
  record_id:       string
  ma_da:           string
  ten_da:          string
  chu_dau_tu:      string
  tong_thau:       string
  loai_da:         string
  quy_mo:          string
  tinh_thanh:      string
  giai_doan:       string
  gia_tri_dt:      number
  gia_tri_hd:      number
  ngay_bao_gia:    number | null
  ngay_du_kien_ky: number | null
  ngay_bt_tc:      number | null
  ngay_hoan_thanh: number | null
  nv_phu_trach:    string
  doi_tac:         string
  ty_le_thang:     number
  cong_no:         number
  ghi_chu:         string
}

export function mapContract(r: any): Contract {
  return {
    record_id:       r.id?.toString()    ?? '',
    ma_hd:           r.ma_hd             ?? '',
    khach_hang:      r.customers?.ho_ten ?? '',
    sdt:             r.customers?.sdt    ?? '',
    nguoi_phu_trach: r.staff?.full_name  ?? '',
    ngay_ky:         toMs(r.ngay_ky),
    gia_tri_hd:      r.gia_tri_hd        ?? 0,
    gia_tri_gws:     r.gia_tri_gws       ?? 0,
    trang_thai:      r.trang_thai        ?? '',
    san_pham:        r.san_pham          ?? [],
    dia_chi_ct:      r.dia_chi_ct        ?? '',
    hh_kinh_doanh:   r.hh_kinh_doanh    ?? 0,
    ngay_giao_dk:    toMs(r.ngay_giao_dk),
    ghi_chu:         r.ghi_chu           ?? '',
    customer_id:     r.customer_id       ?? null,
  }
}

export function mapCommercial(r: any): CommercialOrder {
  return {
    record_id:       r.id?.toString()    ?? '',
    ma_don:          r.ma_don            ?? '',
    ngay_dat:        toMs(r.ngay_dat),
    loai_khach:      r.loai_khach        ?? '',
    ten_kh:          r.ten_kh_tm         ?? '',
    sdt:             r.customers?.sdt    ?? '',
    tinh_thanh:      r.tinh_thanh        ?? '',
    san_pham:        r.san_pham_text     ?? '',
    ma_sp:           r.ma_sp_text        ?? '',
    so_luong:        r.so_luong          ?? 0,
    don_vi:          r.don_vi            ?? '',
    don_gia:         r.don_gia           ?? 0,
    tong_tien:       r.tong_tien         ?? 0,
    phuong_thuc_tt:  r.phuong_thuc_tt    ?? '',
    ngay_giao_dk:    toMs(r.ngay_giao_dk),
    ngay_giao_thuc:  toMs(r.ngay_giao_thuc),
    trang_thai:      r.trang_thai        ?? '',
    nguoi_phu_trach: r.staff?.full_name              ?? '',
    ghi_chu:         r.ghi_chu                        ?? '',
    dia_chi:         r.customers?.dia_chi_ct          ?? '',
    customer_id:     r.customer_id                    ?? null,
  }
}

export function mapProject(r: any): Project {
  return {
    record_id:       r.id?.toString()    ?? '',
    ma_da:           r.ma_da             ?? '',
    ten_da:          r.ten_da            ?? '',
    chu_dau_tu:      r.chu_dau_tu        ?? '',
    tong_thau:       r.tong_thau         ?? '',
    loai_da:         r.loai_da           ?? '',
    quy_mo:          r.quy_mo            ?? '',
    tinh_thanh:      r.tinh_thanh        ?? '',
    giai_doan:       r.giai_doan         ?? '',
    gia_tri_dt:      r.gia_tri_dt        ?? 0,
    gia_tri_hd:      r.gia_tri_hd        ?? 0,
    ngay_bao_gia:    toMs(r.ngay_bao_gia),
    ngay_du_kien_ky: toMs(r.ngay_du_kien_ky),
    ngay_bt_tc:      toMs(r.ngay_bt_tc),
    ngay_hoan_thanh: toMs(r.ngay_hoan_thanh),
    nv_phu_trach:    r.staff?.full_name  ?? '',
    doi_tac:         r.doi_tac_da        ?? '',
    ty_le_thang:     Number(r.ty_le_thang ?? 0),
    cong_no:         r.cong_no           ?? 0,
    ghi_chu:         r.ghi_chu           ?? '',
  }
}

export const mappers = { contract: mapContract, commercial: mapCommercial, project: mapProject }
