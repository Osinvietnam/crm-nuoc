import type { LarkRecord } from '@/lib/lark/client'

export interface Construction {
  record_id: string
  ma_ct: string
  ten_kh: string
  sdt: string
  dia_chi: string
  san_pham: string
  ktv_phu_trach: string
  ngay_gh_thuc: number | null   // kỹ thuật handover → +60 ngày CS
  ngay_nt: number | null         // nghiệm thu → +24 tháng bảo hành
  trang_thai: string
  ghi_chu: string
  // computed
  ngay_can_cs: number | null     // ngay_gh_thuc + 60 days
  ngay_het_bh: number | null     // ngay_nt + 24 months
  cs_overdue: boolean
  bh_expired: boolean
}

export interface PeriodicService {
  record_id: string
  ma_bddk: string
  ten_kh: string
  sdt: string
  dia_chi: string
  san_pham_da_lap: string[]
  dich_vu: string[]
  vat_tu: string[]
  nv_phu_trach: string
  chu_ky: number                 // tháng
  lan_bd_gan_nhat: number | null
  lan_bd_tiep_theo: number | null
  so_ngay_con_lai: number        // pre-calculated by LarkBase
  trang_thai: string
  ghi_chu: string
}

function addDays(ms: number, days: number): number {
  return ms + days * 86400000
}

function addMonths(ms: number, months: number): number {
  const d = new Date(ms)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

function parseLinkText(val: unknown): string {
  if (!val) return ''
  if (Array.isArray(val)) {
    const first = val[0]
    if (first && typeof first === 'object' && 'text' in first) return String((first as { text: unknown }).text ?? '')
    return String(first ?? '')
  }
  if (typeof val === 'object' && val !== null && 'text' in val) return String((val as { text: unknown }).text ?? '')
  return String(val)
}

function parseStringArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String)
  return [String(val)]
}

export function mapConstruction(r: LarkRecord): Construction {
  const f = r.fields
  const ngay_gh_thuc = f['Ngày GH thực'] ? Number(f['Ngày GH thực']) : null
  const ngay_nt = f['Ngày NT'] ? Number(f['Ngày NT']) : null
  const now = Date.now()

  const ngay_can_cs = ngay_gh_thuc ? addDays(ngay_gh_thuc, 60) : null
  const ngay_het_bh = ngay_nt ? addMonths(ngay_nt, 24) : null

  return {
    record_id:      r.record_id,
    ma_ct:          String(f['Mã CT'] ?? ''),
    ten_kh:         String(f['Khách hàng'] ?? ''),
    sdt:            String(f['SĐT đại diện'] ?? ''),
    dia_chi:        String(f['Địa chỉ công trình'] ?? ''),
    san_pham:       '',
    ktv_phu_trach:  String(f['KTV phụ trách'] ?? ''),
    ngay_gh_thuc,
    ngay_nt,
    trang_thai:     String(f['Trạng thái thi công'] ?? ''),
    ghi_chu:        String(f['Ghi chú thi công'] ?? ''),
    ngay_can_cs,
    ngay_het_bh,
    cs_overdue:     ngay_can_cs !== null && now > ngay_can_cs,
    bh_expired:     ngay_het_bh !== null && now > ngay_het_bh,
  }
}

export function mapPeriodic(r: LarkRecord): PeriodicService {
  const f = r.fields
  return {
    record_id:        r.record_id,
    ma_bddk:          String(f['Mã dịch vụ'] ?? ''),
    ten_kh:           String(f['Khách hàng'] ?? ''),
    sdt:              String(f['SĐT'] ?? ''),
    dia_chi:          '',
    san_pham_da_lap:  parseStringArray(f['Sản phẩm đã lắp']),
    dich_vu:          parseStringArray(f['Dịch vụ cần thực hiện']),
    vat_tu:           parseStringArray(f['Vật tư cần chuẩn bị']),
    nv_phu_trach:     parseLinkText(f['NV phụ trách']),
    chu_ky:           Number(f['Chu kỳ (tháng)'] ?? 0),
    lan_bd_gan_nhat:  f['Lần BĐ gần nhất'] ? Number(f['Lần BĐ gần nhất']) : null,
    lan_bd_tiep_theo: f['Lần BĐ tiếp theo'] ? Number(f['Lần BĐ tiếp theo']) : null,
    so_ngay_con_lai:  Number(f['Số ngày còn lại'] ?? 0),
    trang_thai:       String(f['Trạng thái'] ?? ''),
    ghi_chu:          String(f['Ghi chú'] ?? ''),
  }
}

export const mappers = { construction: mapConstruction, periodic: mapPeriodic }
