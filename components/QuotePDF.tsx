'use client'

import {
  Document, Page, Text, View, StyleSheet, Font, pdf, Image,
} from '@react-pdf/renderer'
import type { Quote } from '@/app/api/lark/quotes/_mappers'

// ─── Font ────────────────────────────────────────────────────────────────────
// Convert font → base64 data URI trong main thread, pass vào Font.register
// fontkit nhận ra format từ bytes (không cần extension .ttf trong URL)
// Worker không cần fetch thêm — data đã embedded sẵn trong URI

let _fontsReady: Promise<void> | null = null

async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror   = reject
    reader.readAsDataURL(blob)
  })
}

function ensureFonts(): Promise<void> {
  if (_fontsReady) return _fontsReady
  _fontsReady = (async () => {
    const origin = window.location.origin
    const [regUri, boldUri] = await Promise.all([
      fetch(`${origin}/fonts/Roboto-Regular.ttf`).then(r => r.blob()).then(blobToDataUri),
      fetch(`${origin}/fonts/Roboto-Bold.ttf`).then(r => r.blob()).then(blobToDataUri),
    ])
    Font.register({
      family: 'Roboto',
      fonts: [
        { src: regUri,  fontWeight: 400 },
        { src: boldUri, fontWeight: 700 },
      ],
    })
  })()
  return _fontsReady
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
  colQty:       { width: 32, textAlign: 'center' },
  colNote:      { width: 100 },

  cellText:     { fontSize: 8.5, color: C.dark },
  cellTextMid:  { fontSize: 8, color: C.mid },

  // Summary
  summaryBox:   { alignItems: 'flex-end', marginBottom: 14 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3, gap: 8 },
  summaryLabel: { fontSize: 8.5, color: C.mid, width: 120, textAlign: 'right' },
  summaryValue: { fontSize: 8.5, fontWeight: 700, color: C.dark, width: 100, textAlign: 'right' },
  summaryTotal: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.primary },
  summaryTotalLabel: { fontSize: 10, fontWeight: 700, color: C.primary, width: 120, textAlign: 'right' },
  summaryTotalValue: { fontSize: 10, fontWeight: 700, color: C.primary, width: 100, textAlign: 'right' },

  // Notes
  noteSection:  { marginBottom: 16 },
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompanyInfo {
  name:     string
  address:  string
  phone:    string
  email:    string
  tax:      string
  website:  string
  logo_url: string
}

const COMPANY_FALLBACK: CompanyInfo = {
  name: '', address: '', phone: '', email: '', tax: '', website: '', logo_url: '',
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

export function QuotePDFDocument({ quote, company = COMPANY_FALLBACK }: { quote: Quote; company?: CompanyInfo }) {
  const items  = quote.san_pham.map(parseItem)
  const ck     = quote.chiet_khau
  const tong   = quote.tong_gia_tri
  const final  = quote.gia_tri_sau_ck || tong
  const now    = new Date().toLocaleDateString('vi-VN')

  return (
    <Document title={`Báo giá ${quote.ma_bao_gia}`} author={company.name}>
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
            <Text style={s.titleText}>BÁO GIÁ</Text>
            <Text style={s.titleSub}>{quote.ma_bao_gia}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Info grid ── */}
        <View style={s.infoRow}>
          {/* Khách hàng */}
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>Thông tin khách hàng</Text>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Khách hàng</Text>
              <Text style={s.infoValue}>{quote.khach_hang || '—'}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Số điện thoại</Text>
              <Text style={s.infoValue}>{quote.sdt || '—'}</Text>
            </View>
          </View>

          {/* Báo giá */}
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>Thông tin báo giá</Text>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Phiên bản</Text>
              <Text style={s.infoValue}>v{quote.phien_ban}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Ngày lập</Text>
              <Text style={s.infoValue}>{fmtDate(quote.ngay_lap)}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Hiệu lực đến</Text>
              <Text style={s.infoValue}>{fmtDate(quote.ngay_het_han)}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>Người phụ trách</Text>
              <Text style={s.infoValue}>{quote.nguoi_phu_trach || '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── Bảng sản phẩm ── */}
        <View style={s.tableSection}>
          <Text style={s.tableTitle}>Danh sách sản phẩm đề xuất</Text>

          {/* Head */}
          <View style={s.tableHead}>
            <Text style={[s.tableHeadTxt, s.colStt]}>STT</Text>
            <Text style={[s.tableHeadTxt, s.colName]}>Sản phẩm</Text>
            <Text style={[s.tableHeadTxt, s.colQty]}>SL</Text>
            <Text style={[s.tableHeadTxt, s.colNote]}>Ghi chú</Text>
          </View>

          {/* Rows */}
          {items.map((item, i) => (
            <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.cellText, s.colStt]}>{i + 1}</Text>
              <Text style={[s.cellText, s.colName]}>{item.name}</Text>
              <Text style={[s.cellText, s.colQty]}>{item.qty}</Text>
              <Text style={[s.cellTextMid, s.colNote]}></Text>
            </View>
          ))}
        </View>

        {/* ── Tổng tiền ── */}
        <View style={s.summaryBox}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Tổng giá trị</Text>
            <Text style={s.summaryValue}>{fmtMoney(tong)}</Text>
          </View>
          {ck > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Chiết khấu ({ck}%)</Text>
              <Text style={[s.summaryValue, { color: '#ea580c' }]}>- {fmtMoney(tong - final)}</Text>
            </View>
          )}
          <View style={s.summaryTotal}>
            <Text style={s.summaryTotalLabel}>THÀNH TIỀN</Text>
            <Text style={s.summaryTotalValue}>{fmtMoney(final)}</Text>
          </View>
        </View>

        {/* ── Ghi chú ── */}
        {(quote.ghi_chu_ky_thuat || quote.ghi_chu_thuong_mai) && (
          <>
            <View style={s.dividerLight} />
            <View style={s.noteSection}>
              {quote.ghi_chu_ky_thuat && (
                <>
                  <Text style={s.noteTitle}>Ghi chú kỹ thuật</Text>
                  <Text style={s.noteText}>{quote.ghi_chu_ky_thuat}</Text>
                </>
              )}
              {quote.ghi_chu_thuong_mai && (
                <>
                  <Text style={[s.noteTitle, { marginTop: 6 }]}>Ghi chú thương mại</Text>
                  <Text style={s.noteText}>{quote.ghi_chu_thuong_mai}</Text>
                </>
              )}
            </View>
          </>
        )}

        <View style={s.dividerLight} />

        {/* ── Điều khoản ── */}
        <View style={{ marginBottom: 8 }}>
          <Text style={[s.noteTitle, { marginBottom: 4 }]}>Điều khoản & điều kiện</Text>
          <Text style={s.noteText}>• Báo giá có hiệu lực trong vòng 14 ngày kể từ ngày lập.</Text>
          <Text style={s.noteText}>• Giá chưa bao gồm VAT (nếu có).</Text>
          <Text style={s.noteText}>• Thời gian giao hàng và điều kiện thanh toán theo thỏa thuận.</Text>
        </View>

        {/* ── Chữ ký ── */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Người lập báo giá</Text>
            <Text style={s.sigSub}>(Ký và ghi rõ họ tên)</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{quote.nguoi_phu_trach}</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Đại diện khách hàng</Text>
            <Text style={s.sigSub}>(Ký và ghi rõ họ tên)</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{quote.khach_hang}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{company.name}  |  {company.phone}</Text>
          <Text style={s.footerText}>Xuất ngày {now}  |  {quote.ma_bao_gia} v{quote.phien_ban}</Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── Download helper ──────────────────────────────────────────────────────────

export async function downloadQuotePDF(quote: Quote, company?: CompanyInfo) {
  await ensureFonts()
  const blob = await pdf(<QuotePDFDocument quote={quote} company={company} />).toBlob()
  const url  = URL.createObjectURL(blob)
  // Mở PDF trong tab mới — hoạt động trên mọi thiết bị, user bấm Save/Share
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
