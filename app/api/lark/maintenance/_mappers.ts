// Maintenance interfaces — record_id = Supabase id.toString()
// Reads from maintenance_construction and maintenance_periodic tables

function toMs(d: string | null | undefined): number | null {
  if (!d) return null
  const ms = new Date(d).getTime()
  return isNaN(ms) ? null : ms
}

export interface Construction {
  record_id:      string
  ma_ct:          string
  ten_kh:         string
  sdt:            string
  dia_chi:        string
  san_pham:       string
  ktv_phu_trach:  string
  ngay_gh_thuc:   number | null
  ngay_nt:        number | null
  trang_thai:     string
  ghi_chu:        string
  // GENERATED columns (DATE → ms)
  ngay_can_cs:    number | null
  ngay_het_bh:    number | null
  cs_overdue:     boolean
  bh_expired:     boolean
  customer_id:    number | null
  order_id:       number | null
}

export interface PeriodicService {
  record_id:        string
  ma_bddk:          string
  ten_kh:           string
  sdt:              string
  dia_chi:          string
  san_pham_da_lap:  string[]
  dich_vu:          string[]
  vat_tu:           string[]
  nv_phu_trach:     string
  chu_ky:           number
  lan_bd_gan_nhat:  number | null
  lan_bd_tiep_theo: number | null
  so_ngay_con_lai:  number
  trang_thai:       string
  ghi_chu:          string
  customer_id:      number | null
  order_id:         number | null
}

export function mapConstruction(r: any): Construction {
  const ngay_can_cs = toMs(r.ngay_can_cs)
  const ngay_het_bh = toMs(r.ngay_het_bh)
  const now = Date.now()
  return {
    record_id:      r.id?.toString()      ?? '',
    ma_ct:          r.ma_ct               ?? '',
    ten_kh:         r.customers?.ho_ten   ?? '',
    sdt:            r.customers?.sdt      ?? '',
    dia_chi:        r.customers?.dia_chi  ?? '',
    san_pham:       r.san_pham            ?? '',
    ktv_phu_trach:  r.ktv?.full_name      ?? '',
    ngay_gh_thuc:   toMs(r.ngay_gh_thuc),
    ngay_nt:        toMs(r.ngay_nt),
    trang_thai:     r.trang_thai          ?? '',
    ghi_chu:        r.ghi_chu             ?? '',
    ngay_can_cs,
    ngay_het_bh,
    cs_overdue:     ngay_can_cs !== null && now > ngay_can_cs,
    bh_expired:     ngay_het_bh !== null && now > ngay_het_bh,
    customer_id:    r.customer_id         ?? null,
    order_id:       r.order_id            ?? null,
  }
}

export function mapPeriodic(r: any): PeriodicService {
  const lan_bd_tiep_theo = toMs(r.lan_bd_tiep_theo)
  const so_ngay_con_lai = lan_bd_tiep_theo
    ? Math.ceil((lan_bd_tiep_theo - Date.now()) / 86_400_000)
    : 0
  return {
    record_id:        r.id?.toString()      ?? '',
    ma_bddk:          r.ma_bddk             ?? '',
    ten_kh:           r.customers?.ho_ten   ?? '',
    sdt:              r.customers?.sdt      ?? '',
    dia_chi:          r.customers?.dia_chi  ?? '',
    san_pham_da_lap:  r.san_pham_da_lap     ?? [],
    dich_vu:          r.dich_vu             ?? [],
    vat_tu:           r.vat_tu              ?? [],
    nv_phu_trach:     r.staff?.full_name    ?? '',
    chu_ky:           r.chu_ky              ?? 0,
    lan_bd_gan_nhat:  toMs(r.lan_bd_gan_nhat),
    lan_bd_tiep_theo,
    so_ngay_con_lai,
    trang_thai:       r.trang_thai          ?? '',
    ghi_chu:          r.ghi_chu             ?? '',
    customer_id:      r.customer_id         ?? null,
    order_id:         r.order_id            ?? null,
  }
}

export const mappers = { construction: mapConstruction, periodic: mapPeriodic }
