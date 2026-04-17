'use client'

import {
  Document, Page, Text, View, StyleSheet, Font, pdf, Image,
} from '@react-pdf/renderer'
import type { Contract } from '@/app/api/lark/orders/_mappers'
import type { CompanyInfo } from '@/components/QuotePDF'

// ─── Font ────────────────────────────────────────────────────────────────────
// Dùng absolute URL vì @react-pdf/renderer v4 render trong Blob URL Web Worker
// — relative paths (/fonts/...) fail trong Worker context (null origin)

function registerFonts() {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: `${origin}/fonts/Roboto-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/Roboto-Bold.ttf`,    fontWeight: 700 },
    ],
  })
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const C = {
  primary:   '#1d4ed8',
  dark:      '#1e293b',
  mid:       '#475569',
  light:     '#94a3b8',
  bg:        '#f8fafc',
  border:    '#e2e8f0',
  green:     '#16a34a',
}

const s = StyleSheet.create({
  page:         { fontFamily: 'Roboto', fontSize: 9, color: C.dark, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, backgroundColor: '#ffffff' },

  // Header
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  company:      { flex: 1 },
  logo:         { width: 80, height: 32, objectFit: 'contain', marginBottom: 6 },
  companyName:  { fontSize: 14, fontWeight: 700, color: C.primary, marginBottom: 3 },
  companyMeta:  { fontSize: 7.5, color: C.mid, lineHeight: 1.5 },
  titleBox:     { alignItems: 'flex-end' },
  titleText:    { fontSize: 20, fontWeight: 700, color: C.primary, letterSpacing: 2 },
  titleSub:     { fontSize: 8, color: C.mid, marginTop: 3 },

  divider:      { borderBottomWidth: 1.5, borderBottomColor: C.primary, marginBottom: 14 },
  dividerLight: { borderBottomWidth: 0.5, borderBottomColor: C.border, marginVertical: 10 },

  // Info grid
  infoRow:      { flexDirection: 'row', gap: 16, marginBottom: 14 },
  infoBox:      { flex: 1, backgroundColor: C.bg, borderRadius: 4, padding: 10, borderWidth: 0.5, borderColor: C.border },
  infoTitle:    { fontSize: 7, fontWeight: 700, color: C.light, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  infoLine:     { flexDirection: 'row', marginBottom: 4 },
  infoLabel:    { fontSize: 8, color: C.mid, width: 90 },
  infoValue:    { fontSize: 8, fontWeight: 700, color: C.dark, flex: 1 },

  // Table
  tableSection: { marginBottom: 14 },
  tableTitle:   { fontSize: 7, fontWeight: 700, color: C.light, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  tableHead:    { flexDirection: 'row', backgroundColor: C.primary, borderRadius: 3, paddingVertical: 6, paddingHorizontal: 8 },
  tableHeadTxt: { fontSize: 7.5, fontWeight: 700, color: '#ffffff' },
  tableRow:     { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableRowAlt:  { backgroundColor: C.bg },

  colStt:       { width: 24 },
  colName:      { flex: 1 },
  colQty:       { width: 40, textAlign: 'center' },

  cellText:     { fontSize: 8.5, color: C.dark },

  // Summary
  summaryBox:   { alignItems: 'flex-end', marginBottom: 14 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3, gap: 8 },
  summaryLabel: { fontSize: 8.5, color: C.mid, width: 140, textAlign: 'right' },
  summaryValue: { fontSize: 8.5, fontWeight: 700, color: C.dark, width: 110, textAlign: 'right' },
  summaryTotal: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.primary },
  summaryTotalLabel: { fontSize: 10, fontWeight: 700, color: C.primary, width: 140, textAlign: 'right' },
  summaryTotalValue: { fontSize: 10, fontWeight: 700, color: C.primary, width: 110, textAlign: 'right' },

  // Payment terms
  termsSection: { marginBottom: 14 },
  termsTitle:   { fontSize: 7, fontWeight: 700, color: C.light, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  termsText:    { fontSize: 8.5, color: C.mid, lineHeight: 1.6, marginBottom: 2 },

  // Notes
  noteSection:  { marginBottom: 14 },
  noteTitle:    { fontSize: 7, fontWeight: 700, color: C.light, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  noteText:     { fontSize: 8.5, color: C.mid, lineHeight: 1.5 },

  // Signature
  sigRow:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  sigBox:       { width: '45%', alignItems: 'center' },
  sigTitle:     { fontSize: 8.5, fontWeight: 700, color: C.dark, marginBottom: 3 },
  sigSub:       { fontSize: 7.5, color: C.light, marginBottom: 40 },
  sigLine:      { borderBottomWidth: 0.5, borderBottomColor: C.mid, width: '80%', marginBottom: 3 },
  sigName:      { fontSize: 7.5, color: C.mid },

  // Footer
  footer:       { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
  footerText:   { fontSize: 7, color: C.light },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (ms: number | null) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

const fmtMoney = (n: number) =>
  n ? n.toLocaleString('vi-VN') + ' VNĐ' : '—'

function parseItem(sp: string): { name: string; qty: number } {
  const m = sp.match(/^(.*?)\s*\((\d+)x\)$/)
  return m ? { name: m[1].trim(), qty: Number(m[2]) } : { name: sp, qty: 1 }
}

const COMPANY_FALLBACK: CompanyInfo = {
  name: '', address: '', phone: '', email: '', tax: '', website: '', logo_url: '',
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

export function ContractPDFDocument({ contract, company = COMPANY_FALLBACK }: { contract: Contract; company?: CompanyInfo }) {
  const items = contract.san_pham.map(parseItem)
  const now   = new Date().toLocaleDateString('vi-VN')

  return (
    <Document title={`Hợp đồng ${contract.ma_hd}`} author={company.name}>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.company}>
            {company.logo_url ? (
              <Image src={company.logo_url} style={s.logo} />
            ) : null}
            <Text style={s.companyName}>{company.name}</Text>
            <Text style={s.companyMeta}>{company.address}</Text>
            <Text style={s.companyMeta}>Tel: {company.phone}  |  Email: {company.email}</Text>
            <Text style={s.companyMeta}>MST: {company.tax}</Text>
          </View>
          <View style={s.titleBox}>
            <Text style={s.titleText}>HỢP ĐỒNG</Text>
            <Text style={s.titleSub}>{contract.ma_hd}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Info grid ── */}
        <View style={s.infoRow}>
          {/* Bên mua */}
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>Bên mua (Khách hàng)</Text>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Họ tên</Text>
              <Text style={s.infoValue}>{contract.khach_hang || '—'}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>SĐT</Text>
              <Text style={s.infoValue}>{contract.sdt || '—'}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Địa chỉ công trình</Text>
              <Text style={s.infoValue}>{contract.dia_chi_ct || '—'}</Text>
            </View>
          </View>

          {/* Thông tin hợp đồng */}
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>Thông tin hợp đồng</Text>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Mã HĐ</Text>
              <Text style={s.infoValue}>{contract.ma_hd || '—'}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Ngày ký</Text>
              <Text style={s.infoValue}>{fmtDate(contract.ngay_ky)}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Trạng thái</Text>
              <Text style={s.infoValue}>{contract.trang_thai || '—'}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Người phụ trách</Text>
              <Text style={s.infoValue}>{contract.nguoi_phu_trach || '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── Bảng sản phẩm ── */}
        <View style={s.tableSection}>
          <Text style={s.tableTitle}>Danh sách sản phẩm</Text>

          {/* Head */}
          <View style={s.tableHead}>
            <Text style={[s.tableHeadTxt, s.colStt]}>STT</Text>
            <Text style={[s.tableHeadTxt, s.colName]}>Tên sản phẩm</Text>
            <Text style={[s.tableHeadTxt, s.colQty]}>SL</Text>
          </View>

          {/* Rows */}
          {items.map((item, i) => (
            <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.cellText, s.colStt]}>{i + 1}</Text>
              <Text style={[s.cellText, s.colName]}>{item.name}</Text>
              <Text style={[s.cellText, s.colQty]}>{item.qty}</Text>
            </View>
          ))}
        </View>

        {/* ── Tổng tiền ── */}
        <View style={s.summaryBox}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Giá trị hợp đồng</Text>
            <Text style={s.summaryValue}>{fmtMoney(contract.gia_tri_hd)}</Text>
          </View>
          {contract.gia_tri_gws > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Giá trị GWS</Text>
              <Text style={s.summaryValue}>{fmtMoney(contract.gia_tri_gws)}</Text>
            </View>
          )}
          <View style={s.summaryTotal}>
            <Text style={s.summaryTotalLabel}>TỔNG GIÁ TRỊ</Text>
            <Text style={s.summaryTotalValue}>{fmtMoney(contract.gia_tri_hd)}</Text>
          </View>
        </View>

        <View style={s.dividerLight} />

        {/* ── Điều khoản thanh toán ── */}
        <View style={s.termsSection}>
          <Text style={s.termsTitle}>Điều khoản thanh toán</Text>
          <Text style={s.termsText}>• Đợt 1 (60%): Thanh toán khi ký hợp đồng</Text>
          <Text style={s.termsText}>• Đợt 2 (35%): Thanh toán khi nghiệm thu bàn giao</Text>
          <Text style={s.termsText}>• Đợt 3 (5%): Thanh toán sau bảo hành 12 tháng</Text>
        </View>

        {/* ── Ghi chú ── */}
        {contract.ghi_chu ? (
          <>
            <View style={s.dividerLight} />
            <View style={s.noteSection}>
              <Text style={s.noteTitle}>Ghi chú</Text>
              <Text style={s.noteText}>{contract.ghi_chu}</Text>
            </View>
          </>
        ) : null}

        {/* ── Chữ ký ── */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Bên bán / Đại diện công ty</Text>
            <Text style={s.sigSub}>(Ký và ghi rõ họ tên)</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{contract.nguoi_phu_trach}</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Bên mua / Khách hàng</Text>
            <Text style={s.sigSub}>(Ký và ghi rõ họ tên)</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{contract.khach_hang}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{company.name}  |  {company.phone}</Text>
          <Text style={s.footerText}>{contract.ma_hd}  |  Xuất ngày {now}</Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── Download helper ──────────────────────────────────────────────────────────

export async function downloadContractPDF(contract: Contract, company?: CompanyInfo) {
  registerFonts()
  const blob = await pdf(<ContractPDFDocument contract={contract} company={company} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${contract.ma_hd}-hop-dong.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
