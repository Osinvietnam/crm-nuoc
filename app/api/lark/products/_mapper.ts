// Product interface — used by UI components (record_id = Supabase id.toString())

export interface Product {
  record_id:      string
  ten_sp:         string
  ma_sp:          string
  phan_loai:      string
  nhom_sp:        string
  gia_niem_yet:   number
  gia_chiet_khau: number
  gia_dai_ly:     number
  gia_npp:        number
  hh_kd:          number  // % Hoa hồng KD
  don_vi:         string
  mo_ta:          string
  anh_sp:         string  // Legacy URL — use productImageUrl(record_id) for Storage-based images
  con_hang:       boolean
  sort_order:     number
  created_at:     string | null
  updated_at:     string | null
}

export function mapProduct(r: any): Product {
  return {
    record_id:      r.id?.toString() ?? r.record_id ?? '',
    ten_sp:         r.ten_sp         ?? '',
    ma_sp:          r.ma_sp          ?? '',
    phan_loai:      r.phan_loai      ?? '',
    nhom_sp:        r.nhom_sp        ?? '',
    gia_niem_yet:   r.gia_niem_yet   ?? 0,
    gia_chiet_khau: r.gia_chiet_khau ?? 0,
    gia_dai_ly:     r.gia_dai_ly     ?? 0,
    gia_npp:        r.gia_npp        ?? 0,
    hh_kd:          r.hh_kd          ?? 0,
    don_vi:         r.don_vi         ?? 'cái',
    mo_ta:          r.mo_ta          ?? '',
    anh_sp:         r.anh_sp         ?? '',
    con_hang:       r.con_hang       ?? true,
    sort_order:     r.sort_order     ?? 0,
    created_at:     r.created_at     ?? null,
    updated_at:     r.updated_at     ?? null,
  }
}
