'use client'

import {
  Document, Page, Text, View, StyleSheet, Font, pdf,
} from '@react-pdf/renderer'

// ─── Font (reuse singleton from QuotePDF if already loaded) ──────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReceiptData {
  receipt_no:     string      // e.g. "PT-2026-001"
  customer_name:  string
  nguoi_phu_trach?: string | null
  installment:    number
  amount:         number
  paid_date:      string      // YYYY-MM-DD
  notes?:         string | null
}

export interface CompanyInfo {
  ten_cty:        string
  dia_chi?:       string
  dien_thoai?:    string
  email?:         string
  ma_so_thue?:    string
  bank_name?:     string
  account_number?: string
  account_holder?: string
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:     { fontFamily: 'Roboto', fontSize: 10, color: '#1e293b', padding: 48, backgroundColor: '#ffffff' },
  title:    { fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 9, textAlign: 'center', color: '#64748b', marginBottom: 24 },
  divider:  { borderBottom: 1, borderColor: '#e2e8f0', marginVertical: 16 },
  row:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label:    { color: '#64748b', fontSize: 9 },
  value:    { fontWeight: 700, fontSize: 10 },
  amount:   { fontSize: 18, fontWeight: 700, color: '#16a34a', textAlign: 'center', marginVertical: 16 },
  amtLabel: { fontSize: 9, textAlign: 'center', color: '#64748b', marginBottom: 4 },
  footer:   { marginTop: 32, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
  section:  { marginBottom: 8 },
  sectionTitle: { fontSize: 8, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase' },
  bankRow:  { flexDirection: 'row', gap: 4 },
  bankLabel:{ color: '#64748b', fontSize: 8, width: 90 },
  bankVal:  { fontSize: 8, fontWeight: 700 },
  sigBlock: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 },
  sigBox:   { alignItems: 'center', width: '45%' },
  sigTitle: { fontSize: 9, fontWeight: 700, marginBottom: 32 },
  sigLine:  { borderBottom: 1, borderColor: '#94a3b8', width: '100%' },
  sigName:  { fontSize: 8, color: '#64748b', marginTop: 4 },
})

// ─── Document ─────────────────────────────────────────────────────────────────

function ReceiptDocument({ data, company }: { data: ReceiptData; company: CompanyInfo }) {
  const fmtMoney = (n: number) => n.toLocaleString('vi-VN') + ' đ'
  const fmtDate  = (d: string) => {
    const [y, m, dd] = d.split('-')
    return `Ngày ${dd} tháng ${m} năm ${y}`
  }

  return (
    <Document title={`Biên lai ${data.receipt_no}`}>
      <Page size="A5" style={s.page}>
        {/* Header */}
        <Text style={s.title}>BIÊN LAI THU TIỀN</Text>
        <Text style={s.subtitle}>PAYMENT RECEIPT · {data.receipt_no}</Text>

        <View style={s.divider} />

        {/* Company */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Đơn vị thu</Text>
          <View style={s.row}>
            <Text style={s.label}>Công ty</Text>
            <Text style={s.value}>{company.ten_cty}</Text>
          </View>
          {company.ma_so_thue ? (
            <View style={s.row}>
              <Text style={s.label}>MST</Text>
              <Text style={s.value}>{company.ma_so_thue}</Text>
            </View>
          ) : null}
          {company.dien_thoai ? (
            <View style={s.row}>
              <Text style={s.label}>SĐT</Text>
              <Text style={s.value}>{company.dien_thoai}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.divider} />

        {/* Customer */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Người nộp tiền</Text>
          <View style={s.row}>
            <Text style={s.label}>Khách hàng</Text>
            <Text style={s.value}>{data.customer_name}</Text>
          </View>
          {data.nguoi_phu_trach ? (
            <View style={s.row}>
              <Text style={s.label}>Nhân viên phụ trách</Text>
              <Text style={s.value}>{data.nguoi_phu_trach}</Text>
            </View>
          ) : null}
          <View style={s.row}>
            <Text style={s.label}>Nội dung</Text>
            <Text style={s.value}>Thanh toán đợt {data.installment}</Text>
          </View>
          {data.notes ? (
            <View style={s.row}>
              <Text style={s.label}>Ghi chú</Text>
              <Text style={s.value}>{data.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Amount */}
        <View style={s.divider} />
        <Text style={s.amtLabel}>Số tiền đã thu</Text>
        <Text style={s.amount}>{fmtMoney(data.amount)}</Text>
        <Text style={{ ...s.subtitle, marginBottom: 0 }}>{fmtDate(data.paid_date)}</Text>

        {/* Bank info */}
        {(company.bank_name || company.account_number) ? (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <Text style={s.sectionTitle}>Thông tin chuyển khoản</Text>
              {company.bank_name ? <View style={s.bankRow}><Text style={s.bankLabel}>Ngân hàng:</Text><Text style={s.bankVal}>{company.bank_name}</Text></View> : null}
              {company.account_number ? <View style={s.bankRow}><Text style={s.bankLabel}>Số TK:</Text><Text style={s.bankVal}>{company.account_number}</Text></View> : null}
              {company.account_holder ? <View style={s.bankRow}><Text style={s.bankLabel}>Chủ TK:</Text><Text style={s.bankVal}>{company.account_holder}</Text></View> : null}
            </View>
          </>
        ) : null}

        <View style={s.divider} />

        {/* Signatures */}
        <View style={s.sigBlock}>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Người nộp tiền</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{data.customer_name}</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>Người thu tiền</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{data.nguoi_phu_trach ?? ''}</Text>
          </View>
        </View>

        <Text style={s.footer}>
          Biên lai được tạo bởi hệ thống CRM — {company.ten_cty}
        </Text>
      </Page>
    </Document>
  )
}

// ─── Export function ──────────────────────────────────────────────────────────

export async function downloadReceiptPDF(data: ReceiptData, company: CompanyInfo) {
  await ensureFonts()
  const blob = await pdf(<ReceiptDocument data={data} company={company} />).toBlob()
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
