'use client'

import {
  Document, Page, Text, View, StyleSheet, Font, pdf,
} from '@react-pdf/renderer'
import type { Contract } from '@/app/api/lark/orders/_mappers'
import { soThanhChu } from '@/lib/so-bang-chu'

// ─── Font ────────────────────────────────────────────────────────────────────
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
    const [regUri, boldUri, italicUri] = await Promise.all([
      fetch(`${origin}/fonts/Roboto-Regular.ttf`).then(r => r.blob()).then(blobToDataUri),
      fetch(`${origin}/fonts/Roboto-Bold.ttf`).then(r => r.blob()).then(blobToDataUri),
      fetch(`${origin}/fonts/Roboto-Regular.ttf`).then(r => r.blob()).then(blobToDataUri),
    ])
    Font.register({
      family: 'Roboto',
      fonts: [
        { src: regUri,    fontWeight: 400 },
        { src: boldUri,   fontWeight: 700 },
        { src: italicUri, fontWeight: 400, fontStyle: 'italic' },
      ],
    })
  })()
  return _fontsReady
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ContractItem {
  ten_sp:    string
  so_luong:  number
  don_gia:   number
  thanh_tien: number
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:       { fontFamily: 'Roboto', fontSize: 10, color: '#111', paddingTop: 42, paddingBottom: 56, paddingLeft: 56, paddingRight: 40 },

  // ── Quốc hiệu ──
  quocHieu:   { textAlign: 'center', fontWeight: 700, fontSize: 11, marginBottom: 2 },
  docLap:     { textAlign: 'center', fontWeight: 700, fontSize: 10, marginBottom: 2 },
  dashedLine: { textAlign: 'center', fontSize: 9, marginBottom: 12 },

  // ── Tiêu đề HĐ ──
  hdTitle:    { textAlign: 'center', fontWeight: 700, fontSize: 13, marginBottom: 2 },
  hdSub:      { textAlign: 'center', fontWeight: 700, fontSize: 13, marginBottom: 4 },
  hdNum:      { textAlign: 'center', fontSize: 10, marginBottom: 14 },

  // ── Căn cứ ──
  bullet:     { flexDirection: 'row', marginBottom: 3, paddingLeft: 10 },
  bulletDot:  { width: 14, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.5 },

  // ── Ngày ký ──
  ngayKy:     { fontSize: 10, fontStyle: 'italic', marginBottom: 12, marginTop: 10 },

  // ── Bên A/B ──
  partyHeader: { fontWeight: 700, fontSize: 10, marginBottom: 5, marginTop: 8 },
  infoRow:    { flexDirection: 'row', marginBottom: 3 },
  infoLabel:  { width: 110, fontSize: 10 },
  infoColon:  { width: 12, fontSize: 10 },
  infoValue:  { flex: 1, fontSize: 10, fontWeight: 700 },
  infoValueNormal: { flex: 1, fontSize: 10 },

  // ── Công trình ──
  ctRow:      { flexDirection: 'row', marginBottom: 3 },
  ctLabel:    { fontSize: 10, fontWeight: 400 },
  ctValue:    { fontSize: 10, fontWeight: 700 },

  // ── Mở đầu ──
  intro:      { fontSize: 10, marginTop: 10, marginBottom: 14, lineHeight: 1.5 },

  // ── Article ──
  articleHeader: { flexDirection: 'row', marginTop: 10, marginBottom: 4 },
  articleNum:    { fontSize: 10, fontWeight: 700, textDecoration: 'underline' },
  articleTitle:  { fontSize: 10, fontWeight: 700, textDecoration: 'underline', flex: 1 },
  subHeader:     { fontWeight: 700, fontSize: 10, marginBottom: 3, marginTop: 5 },
  bodyText:      { fontSize: 10, lineHeight: 1.5, marginBottom: 3 },
  indent1:       { paddingLeft: 12 },
  indent2:       { paddingLeft: 24 },

  // ── Bảng sản phẩm ──
  table:      { marginTop: 6, marginBottom: 6 },
  tableHead:  { flexDirection: 'row', backgroundColor: '#D9E2F3', paddingVertical: 5, paddingHorizontal: 4 },
  tableRow:   { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#AAAAAA' },
  tableRowAlt:{ backgroundColor: '#F5F8FD' },
  thText:     { fontSize: 9, fontWeight: 700, textAlign: 'center' },
  tdText:     { fontSize: 9 },
  tdRight:    { fontSize: 9, textAlign: 'right' },
  tdCenter:   { fontSize: 9, textAlign: 'center' },
  colStt:     { width: 24 },
  colName:    { flex: 1 },
  colDvt:     { width: 36 },
  colQty:     { width: 40 },
  colPrice:   { width: 70 },
  colTotal:   { width: 76 },

  totalRow:   { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#AAAAAA' },
  totalLabel: { flex: 1, fontSize: 9, fontWeight: 700 },
  totalValue: { width: 76, fontSize: 9, fontWeight: 700, textAlign: 'right' },
  totalRowFinal: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, backgroundColor: '#EBF3FB' },

  // ── Thanh toán ──
  dotLabel:   { fontWeight: 700, fontSize: 10 },
  dotBangChu: { fontSize: 10, fontStyle: 'italic', paddingLeft: 12, marginBottom: 3 },

  // ── Ký kết ──
  sigRow:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  sigBox:     { width: '46%', alignItems: 'center' },
  sigTitle:   { fontSize: 10, fontWeight: 700, marginBottom: 1 },
  sigSpace:   { height: 52 },
  sigName:    { fontSize: 10, fontWeight: 700 },

  // ── Footer ──
  footer:     { position: 'absolute', bottom: 22, left: 56, right: 40, flexDirection: 'row', justifyContent: 'center', borderTopWidth: 0.5, borderTopColor: '#4472C4', paddingTop: 5 },
  footerText: { fontSize: 7.5, color: '#555', textAlign: 'center' },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtVnd = (n: number) => n > 0 ? n.toLocaleString('vi-VN') + ' vnđ' : '..............vnđ'
const fmtVndTable = (n: number) => n > 0 ? n.toLocaleString('vi-VN') : ''

function fmtDate(v: string | number | null): { ngay: string; thang: string; nam: string } {
  if (!v) return { ngay: '...', thang: '...', nam: '......' }
  const dt = new Date(typeof v === 'number' ? v : v)
  if (isNaN(dt.getTime())) return { ngay: '...', thang: '...', nam: '......' }
  return {
    ngay:  String(dt.getDate()),
    thang: String(dt.getMonth() + 1),
    nam:   String(dt.getFullYear()),
  }
}

function Bullet({ text, indent = 1, bold = false }: { text: string; indent?: number; bold?: boolean }) {
  return (
    <View style={[s.bullet, { paddingLeft: indent * 10 }]}>
      <Text style={s.bulletDot}>-</Text>
      <Text style={[s.bulletText, bold ? { fontWeight: 700 } : {}]}>{text}</Text>
    </View>
  )
}

function InfoRow({ label, value, bold = true }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoColon}>:</Text>
      <Text style={bold ? s.infoValue : s.infoValueNormal}>{value || '......................................................'}</Text>
    </View>
  )
}

function ArticleHeader({ num, title }: { num: string; title: string }) {
  return (
    <View style={s.articleHeader}>
      <Text style={s.articleNum}>ĐIỀU {num}: </Text>
      <Text style={s.articleTitle}>{title}</Text>
    </View>
  )
}

// ─── PDF Document ─────────────────────────────────────────────────────────────
export function ContractPDFDocument({
  contract,
  items = [],
}: {
  contract: Contract
  items?: ContractItem[]
}) {
  const d    = fmtDate(contract.ngay_ky)
  const tongCoVat   = contract.gia_tri_hd ?? 0
  const tongChuaVat = tongCoVat > 0 ? Math.round(tongCoVat / 1.1) : 0

  const d1 = Math.round(tongCoVat * 0.50)
  const d2 = Math.round(tongCoVat * 0.45)
  const d3 = tongCoVat - d1 - d2

  // Nếu không có items với giá → dùng san_pham[] fallback
  const displayItems: ContractItem[] = items.length > 0
    ? items
    : (contract.san_pham ?? []).map(sp => ({ ten_sp: sp, so_luong: 1, don_gia: 0, thanh_tien: 0 }))

  return (
    <Document title={`Hợp đồng ${contract.ma_hd}`}>
      <Page size="A4" style={s.page}>

        {/* ── Quốc hiệu ─────────────────────────────────────────────────── */}
        <Text style={s.quocHieu}>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
        <Text style={s.docLap}>Độc lập – Tự do – Hạnh phúc</Text>
        <Text style={s.dashedLine}>–––––––––––––––––</Text>

        {/* ── Tên HĐ ───────────────────────────────────────────────────── */}
        <Text style={s.hdTitle}>HỢP ĐỒNG CUNG CẤP VÀ LẮP ĐẶT</Text>
        <Text style={s.hdSub}>THIẾT BỊ XỬ LÝ NƯỚC</Text>
        <Text style={s.hdNum}>Số: {contract.ma_hd || '......./GWS'}</Text>

        {/* ── Căn cứ ───────────────────────────────────────────────────── */}
        <Bullet text="Căn cứ vào Luật Thương mại số 36/2005/QH11 được Quốc hội thông qua ngày 14/6/2005 và có hiệu lực kể từ ngày 01/01/2006" />
        <Bullet text="Căn cứ vào Luật Doanh nghiệp số 68/2014/QH13, do Quốc Hội Nước Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam ban hành ngày 26/11/2014, có hiệu lực từ ngày 01/07/2015" />
        <Bullet text="Căn cứ vào Luật Dân Sự số 91/2015/QH13 do Quốc Hội Nước Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam ban hành ngày 24/11/2015, có hiệu lực từ ngày 01/01/2017." />
        <Bullet text="Căn cứ nhu cầu, khả năng của hai bên." />

        {/* ── Ngày ký ──────────────────────────────────────────────────── */}
        <Text style={s.ngayKy}>
          {'Hôm nay, ngày ' + d.ngay + ' tháng ' + d.thang + ' năm ' + d.nam + ', Chúng tôi gồm:'}
        </Text>

        {/* ── Bên A ────────────────────────────────────────────────────── */}
        <Text style={s.partyHeader}>BÊN BÁN CUNG CẤP THIẾT BỊ VÀ LẮP ĐẶT (BÊN A):</Text>
        <InfoRow label="Tên đơn vị"       value="CÔNG TY TNHH THƯƠNG MẠI GALAXY WATER SOLUTIONS" />
        <InfoRow label="Địa chỉ"          value="Số 109 Nguyễn Minh Hoàng, Phường Bảy Hiền, TP. Hồ Chí Minh" />
        <InfoRow label="Mã số thuế"       value="0311945766" />
        <InfoRow label="Số điện thoại"    value="(028) 62935959 – 0914790488" />
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Người đại diện</Text>
          <Text style={s.infoColon}>:</Text>
          <Text style={s.infoValue}>Bà TRỊNH KIM NGỌC</Text>
          <Text style={[s.infoValueNormal, { width: 100 }]}>{'  chức vụ : '}</Text>
          <Text style={s.infoValue}>Giám Đốc</Text>
        </View>
        <InfoRow label="Tư vấn viên"      value={(contract.nguoi_phu_trach || '..............................') + '                CCCD'} />

        {/* ── Bên B ────────────────────────────────────────────────────── */}
        <Text style={s.partyHeader}>BÊN MUA THIẾT BỊ VÀ DỊCH VỤ LẮP ĐẶT (BÊN B):</Text>
        <InfoRow label="Tên đơn vị"       value={contract.khach_hang} />
        <InfoRow label="Địa chỉ"          value={contract.dia_chi_ct} />
        <InfoRow label="Mã số thuế"       value="" />
        <InfoRow label="Số điện thoại"    value={contract.sdt} />
        <InfoRow label="Người đại diện"   value="" />
        <InfoRow label="Tài khoản số"     value="" />

        {/* ── Công trình ───────────────────────────────────────────────── */}
        <View style={[s.ctRow, { marginTop: 6 }]}>
          <Text style={s.ctLabel}>{'Công trình: '}</Text>
          <Text style={s.ctValue}>HỆ THỐNG XỬ LÝ NƯỚC SẠCH</Text>
        </View>
        <View style={s.ctRow}>
          <Text style={s.ctLabel}>{'Địa điểm: '}</Text>
          <Text style={s.ctValue}>{contract.dia_chi_ct || '........................................'}</Text>
        </View>

        <Text style={s.intro}>
          Sau khi bàn bạc, thỏa thuận, hai bên thống nhất ký kết hợp đồng cung cấp và lắp đặt thiết bị lọc nước với các điều khoản như sau:
        </Text>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 1                                                         */}
        <ArticleHeader num="1" title="NỘI DUNG THỎA THUẬN" />
        <View style={s.bullet}>
          <Text style={s.bulletDot}>1.1.</Text>
          <Text style={s.bulletText}>
            Bên Bán chỉ có trách nhiệm cung cấp và lắp đặt các hạng mục, thiết bị, vật tư nêu rõ trong bảng kê chi tiết của Hợp đồng này. Mọi yêu cầu bổ sung, thay đổi khác của Bên Mua sẽ được tính là phát sinh ngoài hợp đồng này và thanh toán theo báo giá riêng của Bên Bán.
          </Text>
        </View>
        <Bullet text={'Bên Bán cung cấp và lắp đặt hoàn thiện thiết bị xử lý nước (sau đây gọi tắt là "Thiết bị" hoặc "hàng hóa") cho Bên Mua với chi tiết như sau:'} />

        {/* Bảng sản phẩm */}
        <View style={s.table}>
          {/* Header */}
          <View style={s.tableHead}>
            <Text style={[s.thText, s.colStt]}>Stt</Text>
            <Text style={[s.thText, s.colName]}>Sản phẩm</Text>
            <Text style={[s.thText, s.colDvt]}>Đvt</Text>
            <Text style={[s.thText, s.colQty]}>SL</Text>
            <Text style={[s.thText, s.colPrice]}>Đơn giá\nVNĐ</Text>
            <Text style={[s.thText, s.colTotal]}>Thành tiền\nVNĐ</Text>
          </View>

          {/* Data rows */}
          {displayItems.length > 0 ? displayItems.map((item, i) => (
            <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.tdCenter, s.colStt]}>{i + 1}</Text>
              <Text style={[s.tdText, s.colName]}>{item.ten_sp}</Text>
              <Text style={[s.tdCenter, s.colDvt]}>Bộ</Text>
              <Text style={[s.tdCenter, s.colQty]}>{item.so_luong}</Text>
              <Text style={[s.tdRight, s.colPrice]}>{fmtVndTable(item.don_gia)}</Text>
              <Text style={[s.tdRight, s.colTotal]}>{fmtVndTable(item.thanh_tien)}</Text>
            </View>
          )) : (
            <View style={s.tableRow}>
              <Text style={[s.tdCenter, s.colStt]}>1</Text>
              <Text style={[s.tdText, s.colName]}>Hệ thống lọc nước xử lý nước sạch</Text>
              <Text style={[s.tdCenter, s.colDvt]}></Text>
              <Text style={[s.tdCenter, s.colQty]}></Text>
              <Text style={[s.tdRight, s.colPrice]}></Text>
              <Text style={[s.tdRight, s.colTotal]}></Text>
            </View>
          )}

          {/* Tổng chưa VAT */}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Tổng giá chưa bao gồm thuế</Text>
            <Text style={s.totalValue}>{tongChuaVat > 0 ? tongChuaVat.toLocaleString('vi-VN') : ''}</Text>
          </View>
          {/* Tổng có VAT */}
          <View style={[s.totalRowFinal]}>
            <Text style={s.totalLabel}>Tổng giá đã bao gồm thuế</Text>
            <Text style={s.totalValue}>{tongCoVat > 0 ? tongCoVat.toLocaleString('vi-VN') : ''}</Text>
          </View>
        </View>

        {/* Giá trị HĐ */}
        <Text style={[s.subHeader, { marginTop: 8 }]}>2.  Giá trị hợp đồng:</Text>
        <Bullet text={'Tổng giá trị hợp đồng đã bao gồm thuế giá trị gia tăng là ' + fmtVnd(tongCoVat)} />
        <Bullet text="Tổng trị giá hợp đồng đã bao gồm phí giao hàng, thi công, lắp đặt hoàn thiện và đảm bảo vận hành thiết bị cho Bên Mua" />
        <Bullet text="Tổng trị giá hợp đồng chưa bao gồm: Máy bơm tăng áp / Vật tư kết nối / Khung che cho hệ thống lọc / Chi phí cẩu hàng lên tầng" />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 2 */}
        <ArticleHeader num="2" title="CHẤT LƯỢNG, CHỦNG LOẠI, QUY CÁCH" />
        <Bullet text="Bên Bán bảo đảm rằng hàng hóa là hàng chính hãng, hàng mới 100% không tân trang và chưa sử dụng trước khi giao cho bên Mua." />
        <Bullet text="Cam kết hàng hóa đúng thương hiệu nguồn gốc xuất xứ rõ ràng, đúng tiêu chuẩn của nhà sản xuất, quy định pháp luật, thỏa thuận/hoặc mẫu đã được hai bên chấp thuận" />
        <Bullet text="Cam kết chất lượng đạt tiêu chuẩn nước sinh hoạt và nước uống." />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 3 */}
        <ArticleHeader num="3" title="ĐỊA ĐIỂM VÀ PHƯƠNG THỨC GIAO NHẬN HÀNG HÓA" />
        <Text style={s.subHeader}>1.  Thời gian giao hàng:</Text>
        <Bullet text="Tiến độ giao hàng: Bên Bán giao hàng cho Bên Mua trong thời gian 02-04 ngày kể từ ngày nhận được tạm ứng đợt 01 và có thông báo bằng văn bản/điện thoại/email/zalo (trừ ngày lễ và chủ nhật)" />
        <Text style={s.subHeader}>3.2  Địa điểm giao hàng, lắp đặt:</Text>
        <Bullet text={'Bên Bán giao hàng và lắp đặt hàng hóa cho Bên Mua tại địa chỉ: ' + (contract.dia_chi_ct || '...................')} />
        <Text style={s.subHeader}>3.  Phương thức giao nhận hàng:</Text>
        <Bullet text="Bên Bán giao hàng đến địa điểm theo yêu cầu Bên Mua và tiến hành lắp đặt thiết bị." />
        <Bullet text="Đại diện Bên Mua (Bên B) thực hiện giám sát, nhận hàng và thi công" />
        <Bullet text="Khi nhận hàng Bên Mua có trách nhiệm kiểm tra tình trạng hàng hóa. Nếu phát hiện hàng thiếu hoặc không đúng quy định, Bên Mua có quyền yêu cầu bên Bán đổi lại hàng hóa. Bên Bán chỉ chấp nhận đổi trả hàng 01 lần tại thời điểm hai bên giao nhận." />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 4 */}
        <ArticleHeader num="4" title="PHƯƠNG THỨC THANH TOÁN" />
        <Text style={s.subHeader}>1.  Hình thức thanh toán:</Text>
        <Bullet text="Bên Mua thanh toán cho Bên Bán bằng hình thức chuyển khoản đồng Việt Nam đồng" />
        <Text style={s.subHeader}>4.2  Phương thức thanh toán:</Text>
        <Bullet text={'Giá Trị hợp đồng: ' + fmtVnd(tongCoVat)} />
        <Bullet text="Bên Mua thanh toán cho Bên Bán theo từng đợt như sau:" />

        {/* Đợt 1 */}
        <View style={[s.bullet, { paddingLeft: 20 }]}>
          <Text style={s.bulletDot}>•</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bulletText}><Text style={s.dotLabel}>Thanh toán đợt 1: </Text>{'Bên Mua thanh toán 50% giá trị hợp đồng tương ứng với số tiền là ' + fmtVnd(d1)}</Text>
            <Text style={s.dotBangChu}>{'( Bằng chữ ) ' + (d1 > 0 ? soThanhChu(d1) : '............................................')}</Text>
            <Text style={[s.bulletText, { marginLeft: 12 }]}>trong vòng 02 ngày sau khi hai bên ký hợp đồng.</Text>
          </View>
        </View>
        {/* Đợt 2 */}
        <View style={[s.bullet, { paddingLeft: 20 }]}>
          <Text style={s.bulletDot}>•</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bulletText}><Text style={s.dotLabel}>Thanh toán đợt 2: </Text>{'Bên Mua thanh toán 45% giá trị hợp đồng tương ứng với số tiền là ' + fmtVnd(d2)}</Text>
            <Text style={s.dotBangChu}>{'( Bằng chữ ) ' + (d2 > 0 ? soThanhChu(d2) : '............................................')}</Text>
            <Text style={[s.bulletText, { marginLeft: 12 }]}>sau khi giao hàng đến chân công trình và lắp đặt.</Text>
          </View>
        </View>
        {/* Đợt 3 */}
        <View style={[s.bullet, { paddingLeft: 20 }]}>
          <Text style={s.bulletDot}>•</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bulletText}><Text style={s.dotLabel}>Thanh toán đợt 3: </Text>{'Bên Mua thanh toán 5% giá trị hợp đồng với số tiền là ' + fmtVnd(d3)}</Text>
            <Text style={s.dotBangChu}>{'( Bằng chữ ) ' + (d3 > 0 ? soThanhChu(d3) : '............................................')}</Text>
            <Text style={[s.bulletText, { marginLeft: 12 }]}>sau khi bên Bán hoàn thành việc lắp đặt hệ thống cho bên Mua trong vòng 05 ngày.</Text>
          </View>
        </View>

        <Bullet text="Bên Bán không phải chịu trách nhiệm bất kỳ phí ngân hàng nào nếu Bên Mua thực hiện thanh toán bằng chuyển khoản" />
        <Text style={[s.subHeader, { marginTop: 6 }]}>Thông tin tài khoản:</Text>
        <Text style={[s.bodyText, { paddingLeft: 10 }]}>Tên tài khoản: CÔNG TY TNHH TM GALAXY WATER SOLUTIONS</Text>
        <Text style={[s.bodyText, { paddingLeft: 10, fontWeight: 700 }]}>Số tài khoản: 6360201131599 Tại ngân hàng Agribank - Chi nhánh Tân Bình</Text>
        <Text style={[s.bodyText, { paddingLeft: 10, fontWeight: 700 }]}>Số tài khoản: 118002888468 Tại ngân hàng Vietinbank - Chi nhánh Tân Bình</Text>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 5 */}
        <ArticleHeader num="5" title="BẢO HÀNH" />
        <Bullet text="Bảo hành Hệ thống trong vòng 24 tháng: Bộ Lọc tổng; Bộ Lọc làm mềm (trừ muối viên)" />
        <Bullet text="Bảo hành Lọc uống trong vòng 12 tháng: Lọc sơ cấp (trừ lõi lọc thô); Lọc vi sinh (trừ lõi lọc); Bơm tăng áp, thiết bị điện, bộ cài đặt thời gian" />
        <Bullet text="Nguyên liệu và vật liệu lọc, lõi lọc thô, muối hoàn nguyên, vật tư kết nối đường ống nước là hàng tiêu hao theo thời gian nên không có bảo hành" />
        <Bullet text="Ngày bảo hành được tính từ ngày giao nhận hàng hóa" />
        <Bullet text="Hàng hoá chỉ được bảo hành nếu do lỗi chế tạo/quy trình sản xuất và lỗi vật liệu chế tạo của Nhà sản xuất." />
        <Text style={s.subHeader}>5.2  Hàng hóa không áp dụng bảo hành:</Text>
        <Bullet text="Hết thời hạn bảo hành." />
        <Bullet text="Bất kỳ hư hỏng gây ra bởi rơi rớt, trầy xước, biến dạng; hỏa hoạn, lũ lụt, sấm sét hoặc thiên tai; môi trường có hóa chất tẩy rửa và tính ăn mòn." />
        <Bullet text="Điện áp cấp vào tăng/giảm đột ngột; nguồn điện bị đảo pha, mất pha, chập mạch, cháy nổ do sửa chữa hệ thống điện." />
        <Bullet text="Bất kỳ sản phẩm nào đã bị thay đổi, tháo rời, sửa chữa bởi đơn vị khác không phải của CTY TNHH TM Galaxy Water Solutions" />
        <Bullet text="Việc bảo trì thiết bị và không thực hiện thay thế vật tư theo đúng hướng dẫn và định kỳ hằng năm" />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 6 */}
        <ArticleHeader num="6" title="QUYỀN VÀ NGHĨA VỤ" />
        <Text style={s.subHeader}>1.  Quyền và nghĩa của Bên Bán</Text>
        <Bullet text="Tư vấn viên có trách nhiệm đảm bảo rằng việc tư vấn phải đúng nguồn gốc xuất xứ, thông số kỹ thuật theo tiêu chuẩn của nhà sản xuất và phù hợp với yêu cầu của khách hàng" />
        <Bullet text="Bên Bán đảm bảo việc giao hàng đúng thời hạn, đúng quy cách, chủng loại, số lượng, đơn giá, địa điểm như đã thỏa thuận trong hợp đồng" />
        <Bullet text="Chịu trách nhiệm vận chuyển hàng hóa từ kho đến công trình, đóng gói đảm bảo an toàn cho hàng hóa trong suốt quá trình bốc/dỡ hàng" />
        <Bullet text="Trong trường hợp thiết bị xảy ra sự cố kỹ thuật, Bên Bán có trách nhiệm cử nhân viên kỹ thuật đến kiểm tra trong thời gian 48 giờ (không bao gồm Chủ Nhật và ngày lễ). Liên hệ: 0914 790 488" />
        <Bullet text="Bên Bán có trách nhiệm bảo hành hệ thống theo Điều 5 của hợp đồng" />
        <Bullet text="Bên Bán có quyền yêu cầu bên Mua thanh toán đầy đủ theo hợp đồng, từ chối giao hàng và tạm ngừng thi công lắp đặt nếu Bên Mua chưa hoàn thành nghĩa vụ thanh toán đúng hạn." />
        <Text style={s.subHeader}>2.  Quyền và nghĩa của Bên Mua (Bên B)</Text>
        <Bullet text="Bố trí nhân viên nhận hàng, phối hợp với Bên Bán tại nơi giao nhận hàng để thuận lợi nhất." />
        <Bullet text="Khi nhận hàng Bên Mua phải cử giám sát viên cùng Bên Bán kiểm tra số lượng, phẩm chất, quy cách và tình trạng hàng hóa/thiết bị." />
        <Bullet text="Bên Mua phải chuẩn bị mặt bằng, điện nước an toàn cho bên Bán thực hiện lắp đặt, bàn giao và nghiệm thu. Sự chậm trễ do Bên Mua không tính vào tiến độ của Bên Bán." />
        <Bullet text="Bên Mua được miễn phí lắp đặt 01 lần. Nếu Bên Mua thay đổi vị trí lắp đặt, phí thi công do Bên Mua chi trả." />
        <Bullet text="Bên Mua có trách nhiệm thanh toán đầy đủ cho bên Bán theo đúng nội dung trong hợp đồng đã ký ở mục 4.2" />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 7 */}
        <ArticleHeader num="7" title="PHẠT VI PHẠM" />
        <Bullet text="Mức phạt vi phạm tối đa là 8% giá trị phần nghĩa vụ vi phạm theo Luật Thương mại." />
        <Bullet text="Ngoài khoản phạt vi phạm, Bên vi phạm phải bồi thường toàn bộ thiệt hại thực tế phát sinh cho Bên bị vi phạm." />
        <Text style={s.subHeader}>7.1.  Đối với Bên Bán:</Text>
        <Bullet text="Nếu Bên Bán chậm trễ việc giao hàng thì Bên Bán chịu mức phạt 0.5%/ngày trên tổng giá trị đơn hàng cho mỗi ngày trễ hạn nhưng không vượt quá 8%/tổng giá trị đơn hàng." />
        <Bullet text="Nếu Bên Bán đơn phương chấm dứt hợp đồng thì Bên bán phải chịu phạt 8% giá trị hợp đồng đã ký và hoàn trả lại toàn bộ số tiền mà Bên Mua đã thanh toán cho Bên Bán." />
        <Text style={s.subHeader}>7.2.  Đối với Bên Mua:</Text>
        <Bullet text="Nếu Bên Mua chậm thanh toán quá 10 ngày thì Bên Mua sẽ chịu mức phạt vi phạm lãi suất 0.5%/tháng trên số tiền chậm thanh toán nhưng không vượt quá 8% giá trị Đơn Hàng chậm thanh toán." />
        <Bullet text="Nếu Bên Mua tự hủy hợp đồng thì Bên Mua phải chịu phạt 8% giá trị hợp đồng đã ký và Bên Mua chịu mất khoản tiền cọc." />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 8 */}
        <ArticleHeader num="8" title="THÔNG TIN BẢO MẬT" />
        <Bullet text='Hai bên có trách nhiệm và cam kết bảo mật thông tin sản phẩm, giá trị hợp đồng và những thỏa thuận giữa hai bên, không cung cấp cho bên thứ ba vì bất kỳ lý do gì liên quan đến Hợp Đồng này, nếu không có sự đồng ý bằng văn bản của bên còn lại.' />
        <Bullet text="Không được phép sao chép, cung cấp một phần hay toàn bộ thông tin bảo mật cho bất kỳ bên thứ ba nào biết khi chưa có sự chấp thuận bằng văn bản." />
        <Bullet text="Cam kết không vi phạm quyền sở hữu trí tuệ của nhau trong quá trình thực hiện dự án theo quy định của pháp luật" />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 9 */}
        <ArticleHeader num="9" title="CÁC TRƯỜNG HỢP CHẤM DỨT HỢP ĐỒNG" />
        <Bullet text="Khi các Bên thực hiện xong các quyền và nghĩa vụ quy định trong Hợp đồng này." />
        <Bullet text="Khi một Bên vi phạm hợp đồng dẫn đến Hợp đồng không thể thực hiện được thì phía Bên kia có quyền đơn phương chấm dứt hợp đồng." />
        <Bullet text="Bên Bán có quyền đơn phương chấm dứt hợp đồng nếu Bên Mua vi phạm nghĩa vụ thanh toán quá 10 ngày hoặc tự ý thay đổi thiết kế mà không có sự đồng ý của Bên Bán." />
        <Bullet text="Hợp đồng có thể được chấm dứt do sự thỏa thuận của các Bên." />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 10 */}
        <ArticleHeader num="10" title="BẤT KHẢ KHÁNG" />
        <Bullet text="Trong trường hợp xảy ra Sự kiện bất khả kháng (động đất, bão lụt, chiến tranh, dịch bệnh, cách ly và các trường hợp bất khả kháng khác theo quy định của luật Việt Nam); các nghĩa vụ của các Bên sẽ được tạm ngưng trong thời gian diễn ra Sự kiện bất khả kháng." />
        <Bullet text="Tuy nhiên, Bên chịu ảnh hưởng bởi Sự kiện bất khả kháng, trong vòng bảy (07) ngày kể từ ngày xảy ra Sự kiện bất khả kháng, sẽ thông báo bằng văn bản cho Bên kia biết về bản chất của Sự kiện bất khả kháng và các nghĩa vụ không thể thực hiện." />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 11 */}
        <ArticleHeader num="11" title="THỜI ĐIỂM XÁC LẬP QUYỀN SỞ HỮU CỦA HAI BÊN" />
        <Bullet text="Thời điểm xác lập quyền sở hữu toàn bộ hàng hóa chỉ được chuyển từ Bên Bán sang Bên Mua sau khi Bên Mua hoàn thành nghĩa vụ thanh toán theo Điều 4." />
        <Bullet text="Nếu Bên Mua chưa thanh toán đủ, quyền sở hữu hàng hóa vẫn thuộc Bên Bán; Bên Bán có quyền thu hồi hàng mà không cần sự đồng ý của Bên Mua." />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ĐIỀU 12 */}
        <ArticleHeader num="12" title="ĐIỀU KHOẢN CHUNG" />
        <Bullet text="Hợp đồng có hiệu lực kể từ ngày ký và tự thanh lý sau khi Bên A đã bàn giao, thi công, vận hành hoàn chỉnh thiết bị và Bên B đã thanh toán đầy đủ." />
        <Bullet text="Hợp đồng này có thể sửa đổi, bổ sung theo thỏa thuận bằng văn bản, có đầy đủ chữ ký của người đại diện có thẩm quyền của Hai Bên." />
        <Bullet text="Hai bên cam kết thực hiện nghiêm túc các nội dung, điều khoản thỏa thuận trong hợp đồng này. Nếu không thương lượng giải quyết được thì mỗi bên có quyền yêu cầu Tòa án có thẩm quyền giải quyết. Phán quyết của Tòa án là quyết định cuối cùng, có giá trị ràng buộc các Bên phải thực hiện." />
        <Bullet text="Hợp đồng gồm có 09 (chín) trang được lập thành 02 (hai) bản, mỗi bên giữ 01 (một) bản có giá trị pháp lý như nhau." />

        {/* ── Ký kết ────────────────────────────────────────────────────── */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>ĐẠI DIỆN BÊN BÁN</Text>
            <Text style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>Giám Đốc</Text>
            <View style={s.sigSpace} />
            <Text style={s.sigName}>TRỊNH KIM NGỌC</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigTitle}>ĐẠI DIỆN BÊN MUA</Text>
            <Text style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>(Ký và ghi rõ họ tên)</Text>
            <View style={s.sigSpace} />
            <Text style={s.sigName}>{contract.khach_hang || ''}</Text>
          </View>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            GWS. Galaxy Water Solutions – Web: MaylocnuocUSA.com.Vn
          </Text>
        </View>

      </Page>
    </Document>
  )
}

// ─── Download helper ──────────────────────────────────────────────────────────
export async function downloadContractPDF(
  contract: Contract,
  items?: ContractItem[],
) {
  await ensureFonts()
  const blob = await pdf(
    <ContractPDFDocument contract={contract} items={items} />
  ).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `HopDong-${contract.ma_hd || contract.record_id}-${(contract.khach_hang || 'KhachHang').replace(/\s+/g, '_')}.pdf`,
  })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
