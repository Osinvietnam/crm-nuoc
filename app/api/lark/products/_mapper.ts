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
  mo_ta:          string
  anh_sp:         string  // URL ảnh từ Supabase Storage
  con_hang:       boolean
  updated_at:     string | null
}

// Legacy: kept for import route compatibility
export function productToFields(body: Partial<Product>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  if (body.ten_sp         !== undefined) fields['Tên sản phẩm']       = body.ten_sp
  if (body.ma_sp          !== undefined) fields['Mã SP']               = body.ma_sp
  if (body.phan_loai      !== undefined) fields['Phân loại']           = body.phan_loai
  if (body.nhom_sp        !== undefined) fields['Nhóm SP']             = body.nhom_sp
  if (body.gia_niem_yet   !== undefined) fields['Giá niêm yết (VNĐ)'] = String(body.gia_niem_yet)
  if (body.gia_chiet_khau !== undefined) fields['Giá chiết khấu']      = String(body.gia_chiet_khau)
  if (body.gia_dai_ly     !== undefined) fields['Giá đại lý']          = String(body.gia_dai_ly)
  if (body.gia_npp        !== undefined) fields['Giá nhà phân phối']   = String(body.gia_npp)
  if (body.hh_kd          !== undefined) fields['% Hoa hồng KD']       = String(body.hh_kd)
  if (body.mo_ta          !== undefined) fields['Mô tả']               = body.mo_ta
  return fields
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
    mo_ta:          r.mo_ta          ?? '',
    anh_sp:         r.anh_sp         ?? '',
    con_hang:       r.con_hang       ?? true,
    updated_at:     r.updated_at     ?? null,
  }
}
