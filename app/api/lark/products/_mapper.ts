import type { LarkRecord } from '@/lib/lark/client'

export interface Product {
  record_id: string
  ten_sp: string
  ma_sp: string
  phan_loai: string
  nhom_sp: string
  gia_niem_yet: number
  gia_chiet_khau: number
  gia_dai_ly: number
  gia_npp: number
  hh_kd: number          // % Hoa hồng KD
  mo_ta: string
  anh_sp: string         // URL ảnh từ Supabase Storage
}

export function mapProduct(r: LarkRecord): Product {
  const f = r.fields
  return {
    record_id:      r.record_id,
    ten_sp:         String(f['Tên sản phẩm'] ?? ''),
    ma_sp:          String(f['Mã SP'] ?? ''),
    phan_loai:      String(f['Phân loại'] ?? ''),
    nhom_sp:        String(f['Nhóm SP'] ?? ''),
    gia_niem_yet:   Number(f['Giá niêm yết (VNĐ)'] ?? 0),
    gia_chiet_khau: Number(f['Giá chiết khấu'] ?? 0),
    gia_dai_ly:     Number(f['Giá đại lý'] ?? 0),
    gia_npp:        Number(f['Giá nhà phân phối'] ?? 0),
    hh_kd:          Number(f['% Hoa hồng KD'] ?? 0),
    mo_ta:          String(f['Mô tả'] ?? ''),
    anh_sp:         String(f['Ảnh sản phẩm'] ?? ''),
  }
}

// Map app fields → Lark field names
export function productToFields(body: Partial<Product>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  if (body.ten_sp         !== undefined) fields['Tên sản phẩm']        = body.ten_sp
  if (body.ma_sp          !== undefined) fields['Mã SP']                = body.ma_sp
  if (body.phan_loai      !== undefined) fields['Phân loại']            = body.phan_loai
  if (body.nhom_sp        !== undefined) fields['Nhóm SP']              = body.nhom_sp
  if (body.gia_niem_yet   !== undefined) fields['Giá niêm yết (VNĐ)']  = String(body.gia_niem_yet)
  if (body.gia_chiet_khau !== undefined) fields['Giá chiết khấu']       = String(body.gia_chiet_khau)
  if (body.gia_dai_ly     !== undefined) fields['Giá đại lý']           = String(body.gia_dai_ly)
  if (body.gia_npp        !== undefined) fields['Giá nhà phân phối']    = String(body.gia_npp)
  if (body.hh_kd          !== undefined) fields['% Hoa hồng KD']        = String(body.hh_kd)
  if (body.mo_ta          !== undefined) fields['Mô tả']                = body.mo_ta
  return fields
}
