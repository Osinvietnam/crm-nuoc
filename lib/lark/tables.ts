export const TABLES = {
  CUSTOMERS:        'tbl56uB4wSaACzgm',
  CONTRACTS:        'tbl2l6Z9vPaHfNHs',
  PAYMENTS:         'tbl6lKVsQhrSdp4L',
  PARTNERS:         'tbl1GDMJrfbT7peB',
  STAFF:            'tbl5Zqfu8qQqWBk7',
  PRODUCTS:         'tbl5ekXxzmCADqQw',
  CONSTRUCTION:     'tbl2XRs8cikrVZXL',
  COMMISSIONS:      'tbl5DyW2XI2kmxmE',
  CONTACT_LOG:      'tbl1Z3ok59HWuakP',
  COMMERCIAL:       'tbl47Uve7oTPQ3b0',
  PERIODIC_SERVICE: 'tbl6sFK3nDfFRtLN',
  PROJECTS:         'tbl5zCezRWITxnXL',
  DISTRIBUTORS:     'tbl1ChXjYIhlGN1v',
  QUOTES:           'tblJi0l9GSDGgiFu',
} as const

export const PIPELINE_STAGES = [
  'Lead mới',
  'Tiềm năng',
  'Báo giá',
  'Đàm phán',
  'Chốt HĐ',
  'Giao hàng',
  'Nghiệm thu',
  'Bảo hành',
  'Bảo trì',
  'Lost',
] as const

export type PipelineStage = typeof PIPELINE_STAGES[number]

export const PIPELINE_COLORS: Record<string, { bg: string; text: string }> = {
  'Lead mới':   { bg: 'bg-gray-100',   text: 'text-gray-600' },
  'Tiềm năng':  { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'Báo giá':    { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Đàm phán':   { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Chốt HĐ':   { bg: 'bg-green-100',  text: 'text-green-700' },
  'Nghiệm thu': { bg: 'bg-teal-100',   text: 'text-teal-700' },
  'Giao hàng':  { bg: 'bg-cyan-100',   text: 'text-cyan-700' },
  'Bảo hành':   { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'Bảo trì':    { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Lost':       { bg: 'bg-red-100',    text: 'text-red-700' },
}

export const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  'Cao':       { bg: 'bg-red-100',    text: 'text-red-600' },
  'Trung bình':{ bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Thấp':      { bg: 'bg-gray-100',   text: 'text-gray-500' },
}

export const NGUON_KH_OPTIONS = [
  'Zalo',
  'Facebook',
  'Chạy Ads',
  'Google Ads',
  'Website',
  'Telesale',
  'Hội chợ',
  'Thị trường',
  'Giới thiệu bạn bè',
  'Khách cũ giới thiệu',
  'Đối tác giới thiệu',
  'Đối tác giới thiệu đối tác',
  'Nhà phân phối',
  'Đại lý',
  'KH cũ mua lại',
  'Khác',
] as const

export const LOAI_HINH_NHA_OPTIONS = [
  'Biệt thự',
  'Biệt thự nghỉ dưỡng',
  'Nhà vườn',
  'Nhà phố',
  'Chung cư',
  'Penthouse',
  'Resort',
  'Lâu đài',
  'Văn phòng',
  'Nhà hàng / Khách sạn',
  'Khu công nghiệp',
  'Khác',
] as const

export const NGUON_NUOC_OPTIONS = [
  'Nước máy',
  'Nước giếng khoan',
  'Nước giếng đào',
  'Nước giếng',
  'Nước mặt',
  'Không rõ',
  'Khác',
] as const

// ─── Đơn hàng — TB02 Hợp đồng ───────────────────────────────────────────────

export const CONTRACT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Đã ký - Chờ TT đợt 1': { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'Đã ký - Chờ TT đợt 2': { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'Đã ký - Chờ TT đợt 3': { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'Đang thi công':         { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Chờ nghiệm thu':        { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Hoàn thành':            { bg: 'bg-green-100',  text: 'text-green-700' },
  'Hủy hợp đồng':          { bg: 'bg-red-100',    text: 'text-red-700' },
}

// ─── Đơn hàng — TB10 Bán thương mại ─────────────────────────────────────────

export const COMMERCIAL_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Chờ xác nhận':   { bg: 'bg-gray-100',   text: 'text-gray-600' },
  'Đang chuẩn bị':  { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Đang giao':      { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'Đã giao':        { bg: 'bg-teal-100',   text: 'text-teal-700' },
  'Đã thanh toán':  { bg: 'bg-green-100',  text: 'text-green-700' },
  'Ghi nợ':         { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Hủy':            { bg: 'bg-red-100',    text: 'text-red-700' },
}

export const LOAI_KHACH_OPTIONS = [
  'Đại lý cấp 1',
  'Đại lý cấp 2',
  'Nhà phân phối',
  'Tổng thầu',
  'Dự án',
  'Khác',
] as const

export const PHUONG_THUC_TT_OPTIONS = [
  'Chuyển khoản',
  'Tiền mặt',
  'Ghi nợ 15 ngày',
  'Ghi nợ 30 ngày',
  'Ghi nợ 45 ngày',
  'Ghi nợ 60 ngày',
] as const

// ─── TB1.1 Báo giá ───────────────────────────────────────────────────────────

export const QUOTE_STATUSES = [
  'Nháp',
  'Đã gửi',
  'Đàm phán',
  'Chấp nhận',
  'Từ chối',
  'Hết hạn',
] as const

export type QuoteStatus = typeof QUOTE_STATUSES[number]

export const QUOTE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Nháp':       { bg: 'bg-gray-100',   text: 'text-gray-600' },
  'Đã gửi':     { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'Đàm phán':   { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Chấp nhận':  { bg: 'bg-green-100',  text: 'text-green-700' },
  'Từ chối':    { bg: 'bg-red-100',    text: 'text-red-700' },
  'Hết hạn':    { bg: 'bg-gray-100',   text: 'text-gray-400' },
}

// ─── Đơn hàng — TB12 Dự án & Tổng thầu ─────────────────────────────────────

export const PROJECT_STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  'Tìm hiểu':         { bg: 'bg-gray-100',   text: 'text-gray-600' },
  'Báo giá':          { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Đang thương thảo': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Đã ký HĐ':         { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'Đang thi công':    { bg: 'bg-cyan-100',   text: 'text-cyan-700' },
  'Hoàn thành':       { bg: 'bg-green-100',  text: 'text-green-700' },
  'Thua thầu':        { bg: 'bg-red-100',    text: 'text-red-700' },
  'Tạm dừng':         { bg: 'bg-gray-100',   text: 'text-gray-500' },
}

export const LOAI_DU_AN_OPTIONS = [
  'Resort & Nghỉ dưỡng',
  'Khách sạn',
  'Chung cư / Toà nhà',
  'Biệt thự / Khu đô thị',
  'Nhà máy / Khu công nghiệp',
  'Trường học / Bệnh viện',
  'Nhà hàng / F&B',
  'Khác',
] as const
