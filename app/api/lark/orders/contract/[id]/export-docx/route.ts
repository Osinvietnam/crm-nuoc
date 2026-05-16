import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { soThanhChu } from '@/lib/so-bang-chu'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, HeadingLevel, TabStopType, TabStopPosition,
  PageNumber, UnderlineType,
} from 'docx'

// ─── GET /api/lark/orders/contract/[id]/export-docx ──────────────────────────
// Xuất hợp đồng lọc tổng B2C dạng .docx
// Auth: admin | ceo | director | sales (chỉ xem HĐ của mình)

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtVnd(n: number): string {
  return n.toLocaleString('vi-VN') + ' vnđ'
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '........'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '........'
  return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function tbl_border(color = 'CCCCCC') {
  const b = { style: BorderStyle.SINGLE, size: 4, color }
  return { top: b, bottom: b, left: b, right: b }
}

// ── Text run helpers ───────────────────────────────────────────────────────────
const TNR = 'Times New Roman'

function run(text: string, opts?: {
  bold?: boolean; italic?: boolean; underline?: boolean; size?: number; color?: string
}) {
  return new TextRun({
    text,
    font: TNR,
    size: opts?.size ?? 26,        // 13pt default
    bold:    opts?.bold    ?? false,
    italics: opts?.italic  ?? false,
    color:   opts?.color   ?? undefined,
    underline: opts?.underline ? { type: UnderlineType.SINGLE } : undefined,
  })
}

function para(children: TextRun[], opts?: {
  align?: (typeof AlignmentType)[keyof typeof AlignmentType]
  spaceBefore?: number; spaceAfter?: number
  indent?: { left?: number; hanging?: number }
}) {
  return new Paragraph({
    children,
    alignment: opts?.align,
    spacing: {
      before: opts?.spaceBefore ?? 0,
      after:  opts?.spaceAfter  ?? 80,
      line: 360, lineRule: 'auto' as const,
    },
    indent: opts?.indent,
  })
}

function blankLine() {
  return new Paragraph({ children: [run('')], spacing: { before: 0, after: 80 } })
}

// ── Thông tin bên hàng ────────────────────────────────────────────────────────
function infoRow(label: string, value: string) {
  return new Paragraph({
    children: [
      run(label.padEnd(22), { bold: false }),
      run(': ', {}),
      run(value || '.......................................................', { bold: true }),
    ],
    spacing: { before: 0, after: 60, line: 360, lineRule: 'auto' as const },
    tabStops: [{ type: TabStopType.LEFT, position: 3600 }],
  })
}

// ── Article header ────────────────────────────────────────────────────────────
function articleHeader(so: string, ten: string) {
  return new Paragraph({
    children: [
      run('ĐIỀU ' + so + ': ', { bold: true, underline: true }),
      run(ten, { bold: true, underline: true }),
    ],
    spacing: { before: 200, after: 100, line: 360, lineRule: 'auto' as const },
  })
}

// ── Bullet paragraph ──────────────────────────────────────────────────────────
function bullet(text: string, bold = false) {
  return new Paragraph({
    children: [run(text, { bold })],
    spacing: { before: 0, after: 80, line: 360, lineRule: 'auto' as const },
    indent: { left: 360, hanging: 360 },
    bullet: { level: 0 },
  })
}

// ── Table cell helper ─────────────────────────────────────────────────────────
function tc(content: string | TextRun[], opts?: {
  bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]
  shade?: string; width?: number; vMerge?: boolean; rowSpan?: boolean
  borders?: boolean
}) {
  const children = typeof content === 'string'
    ? [new Paragraph({
        children: [run(content, { bold: opts?.bold, size: 24 })],
        alignment: opts?.align ?? AlignmentType.CENTER,
        spacing: { before: 40, after: 40, line: 300, lineRule: 'auto' as const },
      })]
    : [new Paragraph({
        children: content,
        alignment: opts?.align ?? AlignmentType.CENTER,
        spacing: { before: 40, after: 40, line: 300, lineRule: 'auto' as const },
      })]

  return new TableCell({
    children,
    borders: tbl_border('999999'),
    shading: opts?.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
  })
}

// ── Build product table ───────────────────────────────────────────────────────
function buildProductTable(items: Array<{
  ten_sp: string; so_luong: number; don_gia: number; thanh_tien: number
}>, tongChuaVat: number, tongCoVat: number) {

  const colWidths = [600, 3800, 800, 1000, 1600, 1560]  // total ≈ 9360
  const hdrColor  = 'D9E2F3'

  // Header row
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      tc('Stt',       { bold: true, shade: hdrColor }),
      tc('Sản phẩm',  { bold: true, shade: hdrColor, align: AlignmentType.CENTER }),
      tc('Đvt',       { bold: true, shade: hdrColor }),
      tc('Số lượng',  { bold: true, shade: hdrColor }),
      tc('Đơn giá\nVNĐ', { bold: true, shade: hdrColor }),
      tc('Thành tiền VNĐ', { bold: true, shade: hdrColor }),
    ],
  })

  // Data rows
  const dataRows = items.map((item, idx) =>
    new TableRow({
      children: [
        tc(String(idx + 1), { align: AlignmentType.CENTER }),
        tc(item.ten_sp, { align: AlignmentType.LEFT }),
        tc('Bộ', { align: AlignmentType.CENTER }),
        tc(String(item.so_luong), { align: AlignmentType.CENTER }),
        tc(item.don_gia.toLocaleString('vi-VN'), { align: AlignmentType.RIGHT }),
        tc(item.thanh_tien.toLocaleString('vi-VN'), { align: AlignmentType.RIGHT }),
      ],
    })
  )

  // If no items, add one blank row
  if (dataRows.length === 0) {
    dataRows.push(new TableRow({
      children: [
        tc('1'), tc('Hệ thống lọc nước xử lý nước sạch', { align: AlignmentType.LEFT }),
        tc(''), tc(''), tc(''), tc(''),
      ],
    }))
  }

  // Total rows (2 merged cells spanning col 1-5, value in col 6)
  function totalRow(label: string, value: string, shade = '') {
    return new TableRow({
      children: [
        new TableCell({
          columnSpan: 5,
          children: [new Paragraph({
            children: [run(label, { bold: true, size: 24 })],
            spacing: { before: 40, after: 40 },
          })],
          borders: tbl_border('999999'),
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          shading: shade ? { fill: shade, type: ShadingType.CLEAR } : undefined,
        }),
        tc(value, { bold: true, align: AlignmentType.RIGHT, shade }),
      ],
    })
  }

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      headerRow,
      ...dataRows,
      totalRow('Tổng giá chưa bao gồm thuế', tongChuaVat > 0 ? tongChuaVat.toLocaleString('vi-VN') : ''),
      totalRow('Tổng giá đã bao gồm thuế',   tongCoVat > 0   ? tongCoVat.toLocaleString('vi-VN') : '', 'EBF3FB'),
    ],
  })
}

// ─── Main DOCX builder ────────────────────────────────────────────────────────
function buildContractDoc(data: {
  soHD: string
  ngayKy: string | null
  tuVanVien: string
  // Bên B
  tenBenB: string
  diachiBenB: string
  sdtBenB: string
  mstBenB: string
  nguoiDaiDienB: string
  chucVuB: string
  taiKhoanB: string
  // Công trình
  tenCongTrinh: string
  diadiemCongTrinh: string
  // Items
  items: Array<{ ten_sp: string; so_luong: number; don_gia: number; thanh_tien: number }>
  tongCoVat: number
  // Thanh toán
  dot1: number; dot2: number; dot3: number
}) {

  const tongChuaVat = Math.round(data.tongCoVat / 1.1)
  const pct = (p: number) => Math.round(data.tongCoVat * p / 100)

  const d1 = pct(50); const d2 = pct(45); const d3 = data.tongCoVat - d1 - d2

  const ngayKyParts = data.ngayKy
    ? (() => {
        const dt = new Date(data.ngayKy)
        return { ngay: dt.getDate(), thang: dt.getMonth() + 1, nam: dt.getFullYear() }
      })()
    : { ngay: '...', thang: '...', nam: 2026 }

  // ── Header (để trống — hợp đồng pháp lý không cần watermark header) ─────
  const header = new Header({
    children: [new Paragraph({ children: [] })],
  })

  // ── Footer ────────────────────────────────────────────────────────────────
  const footer = new Footer({
    children: [
      new Paragraph({
        children: [run('GWS. Galaxy Water Solutions – Web: MaylocnuocUSA.com.Vn', { size: 18, color: '404040' })],
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: '4472C4' } },
        spacing: { before: 160, after: 0 },
      }),
    ],
  })

  // ── Document content ──────────────────────────────────────────────────────
  const children = [
    // 1. Quốc hiệu
    para([run('CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, size: 28 })],
      { align: AlignmentType.CENTER }),
    para([run('Độc lập – Tự do – Hạnh phúc', { bold: true, size: 26 })],
      { align: AlignmentType.CENTER }),
    para([run('–––––––––––––––––', { size: 22 })], { align: AlignmentType.CENTER }),
    blankLine(),

    // 2. Tên hợp đồng
    para([run('HỢP ĐỒNG CUNG CẤP VÀ LẮP ĐẶT', { bold: true, size: 30 })],
      { align: AlignmentType.CENTER, spaceBefore: 80 }),
    para([run('THIẾT BỊ XỬ LÝ NƯỚC', { bold: true, size: 30 })],
      { align: AlignmentType.CENTER }),
    para([run('Số: ' + (data.soHD || '......./GWS'), { size: 26 })],
      { align: AlignmentType.CENTER, spaceAfter: 120 }),

    // 3. Căn cứ pháp lý
    bullet('Căn cứ vào Luật Thương mại số 36/2005/QH11 được Quốc hội thông qua ngày 14/6/2005 và có hiệu lực kể từ ngày 01/01/2006'),
    bullet('Căn cứ vào Luật Doanh nghiệp số 68/2014/QH13, do Quốc Hội Nước Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam ban hành ngày 26/11/2014, có hiệu lực từ ngày 01/07/2015'),
    bullet('Căn cứ vào Luật Dân Sự số 91/2015/QH13 do Quốc Hội Nước Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam ban hành ngày 24/11/2015, có hiệu lực từ ngày 01/01/2017.'),
    bullet('Căn cứ nhu cầu, khả năng của hai bên.'),
    blankLine(),

    // 4. Ngày ký
    para([
      run(`Hôm nay, ngày ${ngayKyParts.ngay} tháng ${ngayKyParts.thang} năm ${ngayKyParts.nam}, Chúng tôi gồm:`, { italic: true }),
    ], { spaceAfter: 120 }),

    // 5. Bên A
    para([run('BÊN BÁN CUNG CẤP THIẾT BỊ VÀ LẮP ĐẶT (BÊN A):', { bold: true })],
      { spaceBefore: 80 }),
    infoRow('Tên đơn vị', 'CÔNG TY TNHH THƯƠNG MẠI GALAXY WATER SOLUTIONS'),
    infoRow('Địa chỉ', 'Số 109 Nguyễn Minh Hoàng, Phường Bảy Hiền, TP. Hồ Chí Minh'),
    infoRow('Mã số thuế', '0311945766'),
    infoRow('Số điện thoại', '(028) 62935959 – 0914790488'),
    infoRow('Người đại diện', 'Bà TRỊNH KIM NGỌC                  chức vụ : Giám Đốc'),
    new Paragraph({
      children: [
        run('Tư vấn viên'.padEnd(22), {}),
        run(': ', {}),
        run(data.tuVanVien || '...............................', { bold: true }),
        run('          CCCD: ', {}),
        run('..............................', { bold: true }),
      ],
      spacing: { before: 0, after: 60, line: 360, lineRule: 'auto' as const },
    }),
    blankLine(),

    // 6. Bên B
    para([run('BÊN MUA THIẾT BỊ VÀ DỊCH VỤ LẮP ĐẶT (BÊN B):', { bold: true })],
      { spaceBefore: 80 }),
    infoRow('Tên đơn vị', data.tenBenB),
    infoRow('Địa chỉ', data.diachiBenB),
    infoRow('Mã số thuế', data.mstBenB),
    infoRow('Số điện thoại', data.sdtBenB),
    new Paragraph({
      children: [
        run('Người đại diện    : ', {}),
        run(data.nguoiDaiDienB || '......................................................', { bold: true }),
        run('     chức vụ : ', {}),
        run(data.chucVuB || '................', { bold: true }),
      ],
      spacing: { before: 0, after: 60, line: 360, lineRule: 'auto' as const },
    }),
    infoRow('Tài khoản số', data.taiKhoanB),
    blankLine(),

    // Công trình
    new Paragraph({
      children: [
        run('Công trình: ', {}),
        run(data.tenCongTrinh || 'HỆ THỐNG XỬ LÝ NƯỚC SẠCH', { bold: true }),
      ],
      spacing: { before: 0, after: 60 },
    }),
    new Paragraph({
      children: [
        run('Địa điểm: ', {}),
        run(data.diadiemCongTrinh || '........................................', { bold: true }),
      ],
      spacing: { before: 0, after: 120 },
    }),

    para([run('Sau khi bàn bạc, thỏa thuận, hai bên thống nhất ký kết hợp đồng cung cấp và lắp đặt thiết bị lọc nước với các điều khoản như sau:')],
      { spaceAfter: 120 }),

    // ── ĐIỀU 1 ────────────────────────────────────────────────────────────────
    articleHeader('1', 'NỘI DUNG THỎA THUẬN'),
    para([run('1.1. ', { bold: true }), run('Bên Bán chỉ có trách nhiệm cung cấp và lắp đặt các hạng mục, thiết bị, vật tư nêu rõ trong bảng kê chi tiết của Hợp đồng này. Mọi yêu cầu bổ sung, thay đổi khác của Bên Mua sẽ được tính là phát sinh ngoài hợp đồng này và thanh toán theo báo giá riêng của Bên Bán tại văn bản khác, cụ thể:')]),
    bullet('Bên Bán cung cấp và lắp đặt hoàn thiện thiết bị xử lý nước (sau đây gọi tắt là "Thiết bị" hoặc "hàng hóa") cho Bên Mua với chi tiết như sau:'),
    blankLine(),

    // Product table
    buildProductTable(data.items, tongChuaVat, data.tongCoVat),
    blankLine(),

    // Giá trị HĐ
    para([run('2.', { bold: true }), run('  Giá trị hợp đồng:', { bold: true })], { spaceBefore: 80 }),
    bullet(`Tổng giá trị hợp đồng đã bao gồm thuế giá trị gia tăng là ${data.tongCoVat > 0 ? data.tongCoVat.toLocaleString('vi-VN') + ' vnđ' : '..........vnđ'}`),
    bullet('Tổng trị giá hợp đồng đã bao gồm phí giao hàng, thi công, lắp đặt hoàn thiện và đảm bảo vận hành thiết bị cho Bên Mua'),
    bullet('Tổng trị giá hợp đồng chưa bao gồm:'),
    new Paragraph({
      children: [run('• Máy bơm tăng áp')],
      indent: { left: 720 },
      spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as const },
    }),
    new Paragraph({
      children: [run('• Vật tư kết nối')],
      indent: { left: 720 },
      spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as const },
    }),
    new Paragraph({
      children: [run('• Khung che cho hệ thống lọc.')],
      indent: { left: 720 },
      spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as const },
    }),
    new Paragraph({
      children: [run('• Chi phí cẩu hàng lên tầng')],
      indent: { left: 720 },
      spacing: { before: 0, after: 80, line: 360, lineRule: 'auto' as const },
    }),

    // ── ĐIỀU 2 ────────────────────────────────────────────────────────────────
    articleHeader('2', 'CHẤT LƯỢNG, CHỦNG LOẠI, QUY CÁCH'),
    bullet('Bên Bán bảo đảm rằng hàng hóa là hàng chính hãng, hàng mới 100% không tân trang và chưa sử dụng trước khi giao cho bên Mua.'),
    bullet('Cam kết hàng hóa đúng thương hiệu nguồn gốc xuất xứ rõ ràng, đúng tiêu chuẩn của nhà sản xuất, quy định pháp luật, thỏa thuận/hoặc mẫu đã được hai bên chấp thuận'),
    bullet('Cam kết chất lượng đạt tiêu chuẩn nước sinh hoạt và nước uống.'),

    // ── ĐIỀU 3 ────────────────────────────────────────────────────────────────
    articleHeader('3', 'ĐỊA ĐIỂM VÀ PHƯƠNG THỨC GIAO NHẬN HÀNG HÓA'),
    para([run('1.', { bold: true }), run('  Thời gian giao hàng:', { bold: true })]),
    bullet('Tiến độ giao hàng: Bên Bán giao hàng cho Bên Mua trong thời gian 02-04 ngày kể từ ngày nhận được tạm ứng đợt 01 của Bên Mua và có thông báo bằng văn bản/điện thoại/email/zalo, (trừ ngày lễ và chủ nhật)'),
    para([run('3.2 ', { bold: true }), run('Địa điểm giao hàng, lắp đặt:', { bold: true })], { spaceBefore: 60 }),
    bullet('Bên Bán giao hàng và lắp đặt hàng hóa cho Bên Mua tại địa chỉ ' + (data.diadiemCongTrinh || '...................')),
    para([run('Liên hệ:.......................... Điện thoại:...........................')]),
    para([run('3.', { bold: true }), run('  Phương thức giao nhận hàng:', { bold: true })], { spaceBefore: 60 }),
    bullet('Bên Bán giao hàng đến địa điểm theo yêu cầu Bên Mua và tiến hành lắp đặt thiết bị.'),
    bullet('Đại diện Bên Mua (Bên B) thực hiện giám sát, nhận hàng và thi công'),
    bullet('Khi nhận hàng Bên Mua có trách nhiệm kiểm tra tình trạng hàng hóa bằng cách được quyền mở hàng hóa và kiểm tra tại chỗ. Nếu phát hiện hàng thiếu hoặc không đúng quy định, chủng loại, mẫu mã v.v... theo thỏa thuận trong hợp đồng thì Bên Mua có quyền yêu cầu bên Bán đổi lại hàng hóa theo đúng thỏa thuận trong hợp đồng. Lúc này bên Bán có trách nhiệm khắc phục bằng cách thay thế, bổ sung một phần hoặc toàn bộ hàng hóa để thực hiện đúng quy định trong hợp đồng này. Bên Bán chỉ chấp nhận đổi trả hàng 01 lần tại thời điểm hai bên giao nhận'),

    // ── ĐIỀU 4 ────────────────────────────────────────────────────────────────
    articleHeader('4', 'PHƯƠNG THỨC THANH TOÁN'),
    para([run('1.', { bold: true }), run('  Hình thức thanh toán:', { bold: true })]),
    bullet('Bên Mua thanh toán cho Bên Bán bằng hình thức chuyển khoản đồng thanh toán Việt Nam đồng'),
    para([run('4.2 ', { bold: true }), run('Phương thức thanh toán:', { bold: true })], { spaceBefore: 60 }),
    bullet('Giá Trị hợp đồng: ' + (data.tongCoVat > 0 ? data.tongCoVat.toLocaleString('vi-VN') + ' vnđ' : '.......................vnđ')),
    bullet('Bên Mua thanh toán cho Bên Bán theo từng đợt như sau:'),

    new Paragraph({
      children: [
        run('• ', {}),
        run('Thanh toán đợt 1: ', { bold: true }),
        run('Bên Mua thanh toán 50% giá trị hợp đồng tương ứng với số tiền là '),
        run(d1 > 0 ? d1.toLocaleString('vi-VN') + ' vnđ' : '...............vnđ', { bold: true }),
      ],
      indent: { left: 360 },
      spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as const },
    }),
    new Paragraph({
      children: [run('( Bằng chữ ) ' + (d1 > 0 ? soThanhChu(d1) : '..............................................'), { italic: true })],
      indent: { left: 720 },
      spacing: { before: 0, after: 60, line: 360, lineRule: 'auto' as const },
    }),
    new Paragraph({
      children: [run('trong vòng 02 ngày sau khi hai bên ký hợp đồng.')],
      indent: { left: 720 },
      spacing: { before: 0, after: 80, line: 360, lineRule: 'auto' as const },
    }),

    new Paragraph({
      children: [
        run('• ', {}),
        run('Thanh toán đợt 2: ', { bold: true }),
        run('Bên Mua thanh toán 45% giá trị hợp đồng tương ứng với số tiền là '),
        run(d2 > 0 ? d2.toLocaleString('vi-VN') + ' vnđ' : '...............vnđ', { bold: true }),
      ],
      indent: { left: 360 },
      spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as const },
    }),
    new Paragraph({
      children: [run('( Bằng chữ ) ' + (d2 > 0 ? soThanhChu(d2) : '..............................................'), { italic: true })],
      indent: { left: 720 },
      spacing: { before: 0, after: 60, line: 360, lineRule: 'auto' as const },
    }),
    new Paragraph({
      children: [run('sau khi giao hàng đến chân công trình và lắp đặt.')],
      indent: { left: 720 },
      spacing: { before: 0, after: 80, line: 360, lineRule: 'auto' as const },
    }),

    new Paragraph({
      children: [
        run('• ', {}),
        run('Thanh toán đợt 3: ', { bold: true }),
        run('Bên Mua thanh toán 5% giá trị hợp đồng với số tiền là '),
        run(d3 > 0 ? d3.toLocaleString('vi-VN') + ' vnđ' : '...............vnđ', { bold: true }),
      ],
      indent: { left: 360 },
      spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as const },
    }),
    new Paragraph({
      children: [run('( Bằng chữ ) ' + (d3 > 0 ? soThanhChu(d3) : '..............................................'), { italic: true })],
      indent: { left: 720 },
      spacing: { before: 0, after: 60, line: 360, lineRule: 'auto' as const },
    }),
    new Paragraph({
      children: [run('sau khi bên Bán hoàn thành việc lắp đặt hệ thống cho bên Mua trong vòng 05 ngày.')],
      indent: { left: 720 },
      spacing: { before: 0, after: 80, line: 360, lineRule: 'auto' as const },
    }),

    bullet('Bên Bán không phải chịu trách nhiệm bất kỳ phí ngân hàng nào nếu Bên Mua thực hiện việc thanh toán được bằng chuyển khoản'),
    bullet('Trường hợp Bên Bán hoàn thành việc lắp đặt mà Bên Mua chưa cung cấp nguồn điện, nguồn nước hoặc các nguyên nhân khác do bên Mua chậm tiến độ thực hiện vận hành hệ thống đưa vào sử dụng, thì Bên Bán đồng ý chờ thêm thời gian là 10 ngày. Nếu đến khi đó công trình vẫn chưa hoàn thiện để được vận hành đưa vào sử dụng thì Bên Mua phải có nghĩa vụ thanh toán các phần còn lại cho Bên Bán, sau khi công trình đã hoàn thành Bên Mua thông báo đến bên Bán để tiếp tục các phần công việc còn lại theo hợp đồng'),

    para([run('Thông tin tài khoản như sau:', { bold: true })], { spaceBefore: 80 }),
    para([run('Tên tài khoản: CÔNG TY TNHH TM GALAXY WATER SOLUTIONS')], { indent: { left: 360 } }),
    para([run('Số tài khoản: 6360201131599 Tại ngân hàng Agribank - Chi nhánh Tân Bình', { bold: true })], { indent: { left: 360 } }),
    para([run('Số tài khoản: 118002888468 Tại ngân hàng Vietinbank - Chi nhánh Tân Bình', { bold: true })], { indent: { left: 360 } }),

    // ── ĐIỀU 5 ────────────────────────────────────────────────────────────────
    articleHeader('5', 'BẢO HÀNH'),
    bullet('Bảo hành Hệ thống trong vòng 24 tháng:'),
    new Paragraph({ children: [run('• Bộ Lọc tổng')], indent: { left: 720 }, spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as const } }),
    new Paragraph({ children: [run('• Bộ Lọc làm mềm (trừ muối viên)')], indent: { left: 720 }, spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as const } }),
    bullet('Bảo hành Lọc uống trong vòng 12 tháng:'),
    new Paragraph({ children: [run('• Lọc sơ cấp (trừ lõi lọc thô)')], indent: { left: 720 }, spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as const } }),
    new Paragraph({ children: [run('• Lọc vi sinh (trừ lõi lọc)')], indent: { left: 720 }, spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as const } }),
    new Paragraph({ children: [run('• Bơm tăng áp, thiết bị điện, bộ cài đặt thời gian')], indent: { left: 720 }, spacing: { before: 0, after: 80, line: 360, lineRule: 'auto' as const } }),
    bullet('Nguyên liệu và các vật liệu lọc, lõi lọc thô, muối hoàn nguyên, vật tư kết nối đường ống nước là hàng tiêu hao theo thời gian nên không có bảo hành'),
    bullet('Ngày bảo hành được tính từ ngày giao nhận hàng hóa'),
    bullet('Hàng hoá chỉ được bảo hành nếu do lỗi chế tạo/quy trình sản xuất và lỗi vật liệu chế tạo của Nhà sản xuất.'),
    bullet('Bảo hành chỉ được áp dụng cho hàng hóa khi lắp đặt đúng và đầy đủ các linh kiện được cung cấp và sử dụng đúng theo tiêu chuẩn của nhà sản xuất và hướng dẫn của kỹ thuật viên'),
    para([run('5.2 ', { bold: true }), run('Hàng hóa không áp dụng bảo hành', { bold: true })], { spaceBefore: 80 }),
    bullet('Hết thời hạn bảo hành.'),
    bullet('Bất kỳ hư hỏng gây ra bởi rơi rớt, trầy xước, biến dạng trong quá trình sử dụng hoặc do khách hàng tự vận chuyển, do hỏa hoạn, lũ lụt, sấm sét hoặc thiên tai, vị trí lắp đặt/sử dụng khắc nghiệt (nhiệt độ, độ ẩm quá cao) hoặc lắp đặt trong môi trường có chứa hóa chất tẩy rửa và có tính ăn mòn.'),
    bullet('Điện áp cấp vào tăng/giảm đột ngột và chập chờn; nguồn điện bị đảo pha, mất pha, chập mạch, cháy nổ do việc sửa chữa, thi công hệ thống điện.'),
    bullet('Bất kỳ sản phẩm nào đã bị thay đổi, tháo rời, sửa chữa bởi đơn vị khác không phải của CTY TNHH TM Galaxy Water Solutions'),
    bullet('Việc bảo trì thiết bị và không thực hiện thay thế vật tư theo đúng hướng dẫn và định kỳ hằng năm'),

    // ── ĐIỀU 6 ────────────────────────────────────────────────────────────────
    articleHeader('6', 'QUYỀN VÀ NGHĨA VỤ'),
    para([run('1.', { bold: true }), run('  Quyền và nghĩa của Bên Bán', { bold: true })]),
    bullet('Tư vấn viên có trách nhiệm đảm bảo rằng việc tư vấn phải đúng nguồn gốc xuất xứ, thông số kỹ thuật theo tiêu chuẩn của nhà sản xuất và phù hợp với yêu cầu của khách hàng'),
    bullet('Bên Bán đảm bảo việc giao hàng đúng thời hạn, đúng quy cách, chủng loại, số lượng, đơn giá, địa điểm như đã thỏa thuận trong hợp đồng'),
    bullet('Chịu trách nhiệm vận chuyển hàng hóa từ kho đến công trình việc đóng gói phải đảm bảo đầy đủ an toàn cho hàng hóa trong suốt quá trình bốc/dỡ hàng'),
    bullet('Trong trường hợp thiết bị xảy ra sự cố kỹ thuật, Bên Bán có trách nhiệm cử nhân viên kỹ thuật đến kiểm tra tại địa điểm đặt thiết bị trong thời gian 48 giờ, không bao gồm Chủ Nhật và các ngày nghỉ lễ, Tết theo quy định của Nhà nước.'),
    bullet('Bên Bán có trách nhiệm bảo hành hệ thống theo Điều 5 của hợp đồng'),
    bullet('Bên Bán có quyền yêu cầu bên Mua thanh toán đầy đủ theo hợp đồng mua bán, từ chối việc giao hàng và tạm ngừng việc thi công lắp đặt nếu Bên Mua chưa hoàn thành nghĩa vụ thanh toán đúng hạn.'),
    para([run('2.', { bold: true }), run('  Quyền và nghĩa của Bên Mua (Bên B)', { bold: true })], { spaceBefore: 80 }),
    bullet('Bố trí nhân viên nhận hàng, phối hợp với Bên Bán tại nơi giao nhận hàng để thuận lợi nhất.'),
    bullet('Khi nhận hàng Bên Mua phải có trách nhiệm cử giám sát viên cùng Bên Bán kiểm tra số lượng, phẩm chất, quy cách và tình trạng hàng hóa/thiết bị theo tại thời điểm bàn giao hàng hóa.'),
    bullet('Bên Mua phải chuẩn bị mặt bằng, điện nước an toàn cho bên Bán thực hiện các lắp đặt, bàn giao và nghiệm thu. Sự chậm trễ do Bên Mua không tính vào tiến độ của Bên Bán.'),
    bullet('Bên Mua được miễn phí lắp đặt 01 lần. Nếu Bên Mua thay đổi vị trí lắp đặt, phí thi công do Bên Mua chi trả.'),
    bullet('Bên Mua có trách nhiệm thanh toán đầy đủ cho bên Bán theo đúng nội dung trong hợp đồng đã ký ở mục 4.2'),

    // ── ĐIỀU 7 ────────────────────────────────────────────────────────────────
    articleHeader('7', 'PHẠT VI PHẠM'),
    bullet('Mức phạt vi phạm tối đa là 8% giá trị phần nghĩa vụ vi phạm theo Luật Thương mại.'),
    bullet('Ngoài khoản phạt vi phạm, Bên vi phạm phải bồi thường toàn bộ thiệt hại thực tế phát sinh cho Bên bị vi phạm.'),
    para([run('7.1. ', { bold: true }), run('Đối với Bên Bán:', { bold: true })], { spaceBefore: 80 }),
    bullet('Nếu Bên Bán chậm trễ việc giao hàng thì Bên Bán chịu mức phạt 0.5%/ngày trên tổng giá trị đơn hàng cho mỗi ngày trễ hạn nhưng không vượt quá 8%/tổng giá trị đơn hàng.'),
    bullet('Nếu Bên Bán đơn phương chấm dứt hợp đồng thì Bên bán phải chịu phạt 8% giá trị hợp đồng đã ký và hoàn trả lại toàn bộ số tiền mà Bên Mua đã thanh toán cho Bên Bán.'),
    para([run('7.2. ', { bold: true }), run('Đối với Bên Mua:', { bold: true })], { spaceBefore: 80 }),
    bullet('Nếu Bên Mua chậm thanh toán quá 10 ngày thì Bên Mua sẽ chịu mức phạt vi phạm Hợp đồng có nghĩa vụ trả tiền lãi do chậm thanh toán theo lãi suất 0.5%/tháng trên số tiền chậm thanh toán và thời gian chậm thanh toán nhưng không vượt quá 8% giá trị của số tiền/giá trị Đơn Hàng chậm thanh toán.'),
    bullet('Nếu Bên Mua tự hủy hợp đồng thì Bên Mua phải chịu phạt 8% giá trị hợp đồng đã ký và Bên Mua chịu mất khoản tiền cọc.'),

    // ── ĐIỀU 8 ────────────────────────────────────────────────────────────────
    articleHeader('8', 'THÔNG TIN BẢO MẬT'),
    bullet('Hai bên có trách nhiệm và cam kết bảo mật thông tin sản phẩm, giá trị hợp đồng và những thỏa thuận giữa hai bên, không cung cấp cho bên thứ ba vì bất kỳ lý do gì liên quan đến Hợp Đồng này, nếu không có sự đồng ý bằng văn bản của bên còn lại.'),
    bullet('Không được phép sao chép, cung cấp một phần hay toàn bộ thông tin bảo mật cho bất kỳ bên thứ ba nào biết khi chưa có sự chấp thuận bằng văn bản của bên có quyền sở hữu đối với thông tin bảo mật.'),
    bullet('Cam kết không vi phạm quyền sở hữu trí tuệ của nhau trong quá trình thực hiện dự án theo quy định của pháp luật'),

    // ── ĐIỀU 9 ────────────────────────────────────────────────────────────────
    articleHeader('9', 'CÁC TRƯỜNG HỢP CHẤM DỨT HỢP ĐỒNG'),
    bullet('Khi các Bên thực hiện xong các quyền và nghĩa vụ quy định trong Hợp đồng này.'),
    bullet('Khi một Bên vi phạm hợp đồng dẫn đến Hợp đồng không thể thực hiện được thì phía Bên kia có quyền đơn phương chấm dứt hợp đồng.'),
    bullet('Bên Bán có quyền đơn phương chấm dứt hợp đồng nếu Bên Mua vi phạm nghĩa vụ thanh toán quá 10 ngày hoặc tự ý thay đổi thiết kế mà không có sự đồng ý của Bên Bán.'),
    bullet('Hợp đồng có thể được chấm dứt do sự thỏa thuận của các Bên.'),

    // ── ĐIỀU 10 ───────────────────────────────────────────────────────────────
    articleHeader('10', 'BẤT KHẢ KHÁNG'),
    bullet('Trong trường hợp xảy ra Sự kiện bất khả kháng bao gồm động đất, bão lụt, chiến tranh, dịch bệnh, cách ly và các trường hợp bất khả kháng khác theo quy định của luật Việt Nam; các nghĩa vụ của các Bên theo Hợp đồng này không thể thực hiện được thì sẽ được tạm ngưng trong thời gian diễn ra Sự kiện bất khả kháng.'),
    bullet('Tuy nhiên, Bên chịu ảnh hưởng bởi Sự kiện bất khả kháng, trong vòng bảy (07) ngày kể từ ngày xảy ra Sự kiện bất khả kháng, sẽ thông báo bằng văn bản cho Bên kia biết về bản chất của Sự kiện bất khả kháng và các nghĩa vụ không thể thực hiện.'),

    // ── ĐIỀU 11 ───────────────────────────────────────────────────────────────
    articleHeader('11', 'THỜI ĐIỂM XÁC LẬP QUYỀN SỞ HỮU CỦA HAI BÊN'),
    bullet('Thời điểm xác lập quyền sở hữu toàn bộ hàng hóa nêu trên chỉ được chuyển từ Bên Bán sang Bên Mua sau khi Bên Mua hoàn thành nghĩa vụ thanh toán theo Điều 4.'),
    bullet('Nếu Bên Mua chưa thanh toán đủ, quyền sở hữu hàng hóa vẫn thuộc Bên Bán; Bên Bán có quyền thu hồi hàng mà không cần sự đồng ý của Bên Mua.'),

    // ── ĐIỀU 12 ───────────────────────────────────────────────────────────────
    articleHeader('12', 'ĐIỀU KHOẢN CHUNG'),
    bullet('Hợp đồng có hiệu lực kể từ ngày ký và tự thanh lý sau khi Bên A đã bàn giao, thi công, vận hành hoàn chỉnh thiết bị và Bên B đã thanh toán đầy đủ.'),
    bullet('Hợp đồng này có thể sửa đổi, bổ sung theo thỏa thuận bằng văn bản, có đầy đủ chữ ký của người đại diện có thẩm quyền của Hai Bên.'),
    bullet('Hai bên cam kết thực hiện nghiêm túc các nội dung, điều khoản thỏa thuận trong hợp đồng này. Trong quá trình thực hiện có vấn đề phát sinh, hai bên sẽ cùng bàn bạc, thương lượng giải quyết trên tinh thần hợp tác, thiện chí. Nếu không thương lượng giải quyết được thì mỗi bên có quyền yêu cầu Tòa án có thẩm quyền giải quyết.'),
    bullet('Hợp đồng gồm có 09 (chín) trang được lập thành 02 (hai) bản, mỗi bên giữ 01 (một) bản có giá trị pháp lý như nhau.'),
    blankLine(),
    blankLine(),

    // ── Ký kết ────────────────────────────────────────────────────────────────
    new Paragraph({
      children: [
        run('ĐẠI DIỆN BÊN BÁN', { bold: true }),
        new TextRun({ text: '\t', font: TNR }),
        run('ĐẠI DIỆN BÊN MUA', { bold: true }),
      ],
      alignment: AlignmentType.LEFT,
      tabStops: [{ type: TabStopType.LEFT, position: 5400 }],
      spacing: { before: 0, after: 60 },
    }),
    new Paragraph({
      children: [
        run('Giám Đốc', { bold: true }),
        new TextRun({ text: '\t', font: TNR }),
        run('(Ký và ghi rõ họ tên)', { italic: true }),
      ],
      tabStops: [{ type: TabStopType.LEFT, position: 5400 }],
      spacing: { before: 0, after: 280 },
    }),
    new Paragraph({
      children: [
        run('TRỊNH KIM NGỌC', { bold: true }),
      ],
      spacing: { before: 0, after: 0 },
    }),
  ]

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },   // A4
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1800 },
        },
      },
      headers: { default: header },
      footers: { default: footer },
      children,
    }],
  })
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const isManager = ['admin', 'ceo', 'director'].includes(profile.role)
    if (!['admin', 'ceo', 'director', 'sales'].includes(profile.role)) {
      return NextResponse.json({ error: 'Không có quyền xuất hợp đồng' }, { status: 403 })
    }

    const { id } = await params
    const svc = createServiceClient()

    // ── Fetch order ───────────────────────────────────────────────────────────
    const orderQ = svc
      .from('orders')
      .select(`
        id, ma_hd, gia_tri_hd, ngay_ky, dia_chi_ct, san_pham,
        quote_id, nguoi_phu_trach, customer_id, ghi_chu, trang_thai,
        customers!customer_id(ho_ten, sdt, dia_chi_hd, dia_chi_ct),
        staff:nguoi_phu_trach(full_name)
      `)
      .eq('type', 'b2c')

    const { data: order, error } = await (
      /^\d+$/.test(id) ? orderQ.eq('id', parseInt(id)) : orderQ.eq('ma_hd', id)
    ).single()

    if (error || !order) {
      return NextResponse.json({ error: 'Không tìm thấy hợp đồng' }, { status: 404 })
    }

    // Sales chỉ xuất HĐ của mình
    if (!isManager && order.nguoi_phu_trach !== user.id) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    // ── Fetch quote items (nếu có) ────────────────────────────────────────────
    let items: Array<{ ten_sp: string; so_luong: number; don_gia: number; thanh_tien: number }> = []

    if (order.quote_id) {
      const { data: qItems } = await svc
        .from('quote_items')
        .select('ten_sp, so_luong, don_gia, thanh_tien')
        .eq('quote_id', order.quote_id)
        .order('sort_order')

      if (qItems?.length) {
        items = qItems.map(it => ({
          ten_sp:    it.ten_sp     ?? '',
          so_luong:  it.so_luong   ?? 1,
          don_gia:   it.don_gia    ?? 0,
          thanh_tien: it.thanh_tien ?? 0,
        }))
      }
    }

    // Fallback: dùng san_pham[] nếu không có quote_items
    if (items.length === 0 && Array.isArray(order.san_pham) && order.san_pham.length > 0) {
      items = (order.san_pham as string[]).map(sp => ({
        ten_sp: sp, so_luong: 1, don_gia: 0, thanh_tien: 0,
      }))
    }

    const cust     = (order as any).customers
    const staffRaw = (order as any).staff

    // ── Build DOCX ────────────────────────────────────────────────────────────
    const doc = buildContractDoc({
      soHD:           order.ma_hd ?? '',
      ngayKy:         order.ngay_ky ?? null,
      tuVanVien:      Array.isArray(staffRaw) ? staffRaw[0]?.full_name ?? '' : (staffRaw?.full_name ?? ''),
      tenBenB:        cust?.ho_ten       ?? '',
      diachiBenB:     cust?.dia_chi_hd   ?? cust?.dia_chi_ct ?? '',
      sdtBenB:        cust?.sdt          ?? '',
      mstBenB:        '',        // chưa có trong DB
      nguoiDaiDienB:  '',        // chưa có trong DB
      chucVuB:        '',
      taiKhoanB:      '',
      tenCongTrinh:   'HỆ THỐNG XỬ LÝ NƯỚC SẠCH',
      diadiemCongTrinh: order.dia_chi_ct ?? cust?.dia_chi_ct ?? '',
      items,
      tongCoVat:      order.gia_tri_hd ?? 0,
      dot1: 0, dot2: 0, dot3: 0,
    })

    const buffer = await Packer.toBuffer(doc)

    const fileName = `HopDong-${order.ma_hd ?? id}-${cust?.ho_ten?.replace(/\s+/g, '_') ?? 'KhachHang'}.docx`

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('GET /export-docx:', err)
    return NextResponse.json({ error: 'Lỗi server khi xuất hợp đồng' }, { status: 500 })
  }
}
