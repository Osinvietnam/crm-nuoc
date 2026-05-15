// Quote interface — record_id = Supabase id.toString()

export type QuoteType = 'b2c' | 'commercial' | 'project'

export interface Quote {
  record_id:           string
  type:                QuoteType
  ma_bao_gia:          string
  khach_hang:          string
  sdt:                 string
  email_kh:            string
  dia_chi_ct:          string
  nguoi_phu_trach:     string
  phien_ban:           number
  san_pham:            string[]
  tong_gia_tri:        number
  chiet_khau:          number
  gia_tri_sau_ck:      number
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
  customer_id:         number | null
  items: Array<{
    id:         number
    ten_sp:     string
    don_gia:    number
    so_luong:   number
    thanh_tien: number
    product_id: number | null
    sort_order: number
  }>

  // ── Thương mại ──────────────────────────────────────────────────────────
  loai_khach:    string
  tinh_thanh:    string
  phuong_thuc_tt: string

  // ── Dự án ───────────────────────────────────────────────────────────────
  ten_da:        string
  chu_dau_tu:    string
  loai_da:       string
  quy_mo:        string
  gia_tri_dt:    number
  ngay_nop_thau: number | null
  doi_tac_da:    string
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
    type:               (r.type ?? 'b2c') as QuoteType,
    ma_bao_gia:         r.ma_bao_gia          ?? '',
    khach_hang:         r.customers?.ho_ten   ?? '',
    sdt:                r.sdt                 ?? '',
    email_kh:           r.customers?.email    ?? '',
    dia_chi_ct:         r.customers?.dia_chi_ct ?? r.customers?.dia_chi_hd ?? '',
    nguoi_phu_trach:    r.staff?.full_name    ?? '',
    phien_ban:          r.phien_ban           ?? 1,
    san_pham:           Array.isArray(r.quote_items) && r.quote_items.length > 0
                          ? r.quote_items
                              .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                              .map((it: any) => it.so_luong > 1 ? `${it.ten_sp} (${it.so_luong}x)` : it.ten_sp)
                          : [],
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
    items: Array.isArray(r.quote_items)
      ? r.quote_items.map((it: any) => ({
          id:         it.id,
          ten_sp:     it.ten_sp     ?? '',
          don_gia:    it.don_gia    ?? 0,
          so_luong:   it.so_luong   ?? 1,
          thanh_tien: it.thanh_tien ?? 0,
          product_id: it.product_id ?? null,
          sort_order: it.sort_order ?? 0,
        }))
      : [],

    // Thương mại
    loai_khach:     r.loai_khach     ?? '',
    tinh_thanh:     r.tinh_thanh     ?? '',
    phuong_thuc_tt: r.phuong_thuc_tt ?? '',

    // Dự án
    ten_da:        r.ten_da        ?? '',
    chu_dau_tu:    r.chu_dau_tu    ?? '',
    loai_da:       r.loai_da       ?? '',
    quy_mo:        r.quy_mo        ?? '',
    gia_tri_dt:    r.gia_tri_dt    ?? 0,
    ngay_nop_thau: toMs(r.ngay_nop_thau),
    doi_tac_da:    r.doi_tac_da    ?? '',
  }
}

// ─── State machine per type ───────────────────────────────────────────────────

export const TERMINAL_POSITIVE: Record<QuoteType, string> = {
  b2c:        'Chấp nhận',
  commercial: 'Xác nhận',
  project:    'Thắng thầu',
}

export const TERMINAL_NEGATIVE: Record<QuoteType, string[]> = {
  b2c:        ['Từ chối'],
  commercial: ['Từ chối'],
  project:    ['Thua thầu'],
}

export const STATUSES_BY_TYPE: Record<QuoteType, string[]> = {
  b2c:        ['Nháp', 'Đã gửi', 'Chờ duyệt', 'Đàm phán', 'Chấp nhận', 'Từ chối', 'Hết hạn'],
  commercial: ['Báo giá', 'Đã gửi', 'Xác nhận', 'Từ chối'],
  project:    ['Chuẩn bị HS', 'Đã nộp thầu', 'Chờ kết quả', 'Thắng thầu', 'Thua thầu'],
}

export const ALLOWED_TRANSITIONS_BY_TYPE: Record<QuoteType, Record<string, string[]>> = {
  b2c: {
    'Nháp':       ['Đã gửi', 'Hết hạn'],
    'Đã gửi':    ['Đàm phán', 'Chờ duyệt', 'Từ chối', 'Hết hạn'],
    'Đàm phán':   ['Chờ duyệt', 'Từ chối', 'Hết hạn'],
    'Chờ duyệt':  [],
    'Chấp nhận':  [],
    'Từ chối':    [],
    'Hết hạn':    ['Nháp', 'Đã gửi'],
  },
  commercial: {
    'Báo giá':  ['Đã gửi', 'Từ chối'],
    'Đã gửi':  ['Xác nhận', 'Từ chối'],
    'Xác nhận': [],
    'Từ chối':  [],
  },
  project: {
    'Chuẩn bị HS':   ['Đã nộp thầu'],
    'Đã nộp thầu':   ['Chờ kết quả', 'Thua thầu'],
    'Chờ kết quả':   ['Thắng thầu', 'Thua thầu'],
    'Thắng thầu':    [],
    'Thua thầu':     ['Chuẩn bị HS'],  // Cho phép retry
  },
}
