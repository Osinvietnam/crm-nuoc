import * as XLSX from 'xlsx'
import type { Quote } from '@/app/api/lark/quotes/_mappers'
import type { CompanyInfo } from '@/components/QuotePDF'

const COMPANY_FALLBACK: CompanyInfo = {
  name: '', address: '', phone: '', email: '', tax: '', website: '', logo_url: '',
}

const fmtDate = (ms: number | null) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

const fmtMoney = (n: number) =>
  n ? n.toLocaleString('vi-VN') + ' VNĐ' : '—'

function parseItem(sp: string): { name: string; qty: number } {
  const m = sp.match(/^(.*?)\s*\((\d+)x\)$/)
  return m ? { name: m[1].trim(), qty: Number(m[2]) } : { name: sp, qty: 1 }
}

export function downloadQuoteXLSX(quote: Quote, company: CompanyInfo = COMPANY_FALLBACK) {
  const items = quote.san_pham.map(parseItem)
  const ck    = quote.chiet_khau
  const tong  = quote.tong_gia_tri
  const final = quote.gia_tri_sau_ck || tong

  // ── Build rows ────────────────────────────────────────────────────────────
  const rows: (string | number)[][] = []

  // Header công ty
  rows.push([company.name, '', '', ''])
  rows.push([company.address, '', '', ''])
  rows.push([`Tel: ${company.phone}  |  Email: ${company.email}  |  ${company.tax}`, '', '', ''])
  rows.push(['', '', '', ''])

  // Tiêu đề BG
  rows.push(['BÁO GIÁ', '', '', ''])
  rows.push([`Mã: ${quote.ma_bao_gia}   Phiên bản: v${quote.phien_ban}`, '', '', ''])
  rows.push(['', '', '', ''])

  // Info 2 cột (KH | BG)
  rows.push(['THÔNG TIN KHÁCH HÀNG', '', 'THÔNG TIN BÁO GIÁ', ''])
  rows.push(['Khách hàng',    quote.khach_hang    || '—', 'Ngày lập BG',    fmtDate(quote.ngay_lap)])
  rows.push(['Số điện thoại', quote.sdt           || '—', 'Hiệu lực đến',   fmtDate(quote.ngay_het_han)])
  rows.push(['',              '',                          'Người phụ trách', quote.nguoi_phu_trach || '—'])
  if (quote.kenh_tiep_nhan)
    rows.push(['Nguồn KH', quote.kenh_tiep_nhan, '', ''])
  rows.push(['', '', '', ''])

  // Tiêu đề bảng SP
  const TABLE_HEADER_ROW = rows.length
  rows.push(['STT', 'Sản phẩm', 'Số lượng', 'Ghi chú'])

  // Rows sản phẩm
  items.forEach((item, i) => {
    rows.push([i + 1, item.name, item.qty, ''])
  })
  rows.push(['', '', '', ''])

  // Tổng tiền (cột C-D)
  rows.push(['', '', 'Tổng giá trị', fmtMoney(tong)])
  if (ck > 0) {
    rows.push(['', '', `Chiết khấu (${ck}%)`, `- ${fmtMoney(tong - final)}`])
  }
  rows.push(['', '', 'THÀNH TIỀN', fmtMoney(final)])
  rows.push(['', '', '', ''])

  // Ghi chú
  if (quote.ghi_chu_ky_thuat) {
    rows.push(['Ghi chú kỹ thuật:', '', '', ''])
    rows.push([quote.ghi_chu_ky_thuat, '', '', ''])
    rows.push(['', '', '', ''])
  }
  if (quote.ghi_chu_thuong_mai) {
    rows.push(['Ghi chú thương mại:', '', '', ''])
    rows.push([quote.ghi_chu_thuong_mai, '', '', ''])
    rows.push(['', '', '', ''])
  }

  // Điều khoản
  rows.push(['Điều khoản:', '', '', ''])
  rows.push(['• Báo giá có hiệu lực 14 ngày kể từ ngày lập.', '', '', ''])
  rows.push(['• Giá chưa bao gồm VAT (nếu có).', '', '', ''])
  rows.push(['', '', '', ''])

  // Chữ ký
  rows.push(['Người lập báo giá', '', 'Đại diện khách hàng', ''])
  rows.push(['(Ký và ghi rõ họ tên)', '', '(Ký và ghi rõ họ tên)', ''])
  rows.push(['', '', '', ''])
  rows.push(['', '', '', ''])
  rows.push(['', '', '', ''])
  rows.push([quote.nguoi_phu_trach || '', '', quote.khach_hang || '', ''])

  // ── Create sheet ─────────────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 24 },  // A
    { wch: 36 },  // B
    { wch: 20 },  // C
    { wch: 22 },  // D
  ]

  // Merges: [s]tart / [e]nd {r: row, c: col} (0-indexed)
  ws['!merges'] = [
    // Company header
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
    // BG title
    { s: { r: 4, c: 0 }, e: { r: 4, c: 3 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 3 } },
    // Section headers
    { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } },
    { s: { r: 7, c: 2 }, e: { r: 7, c: 3 } },
    // Table header (merge STT cell only to keep cols)
    // Signature
    { s: { r: rows.length - 6, c: 0 }, e: { r: rows.length - 6, c: 1 } },
    { s: { r: rows.length - 6, c: 2 }, e: { r: rows.length - 6, c: 3 } },
    { s: { r: rows.length - 5, c: 0 }, e: { r: rows.length - 5, c: 1 } },
    { s: { r: rows.length - 5, c: 2 }, e: { r: rows.length - 5, c: 3 } },
    { s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 1 } },
    { s: { r: rows.length - 1, c: 2 }, e: { r: rows.length - 1, c: 3 } },
  ]

  // Row height cho tiêu đề
  ws['!rows'] = Array.from({ length: rows.length }, (_, i) => {
    if (i === 0) return { hpt: 22 }   // company name
    if (i === 4) return { hpt: 20 }   // BÁO GIÁ
    if (i === TABLE_HEADER_ROW) return { hpt: 18 }
    return { hpt: 15 }
  })

  // ── Create workbook & download ────────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Báo giá')

  const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${quote.ma_bao_gia}-v${quote.phien_ban}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
