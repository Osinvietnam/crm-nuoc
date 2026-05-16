// Chuyển số nguyên (VNĐ) sang chữ tiếng Việt
// Ví dụ: 50_000_000 → "Năm mươi triệu đồng"

const CH_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

function doc3So(n: number, laNhomDauTien: boolean): string {
  const tram  = Math.floor(n / 100)
  const chuc  = Math.floor((n % 100) / 10)
  const donvi = n % 10

  let kq = ''

  if (tram > 0) {
    kq += CH_SO[tram] + ' trăm'
    if (chuc === 0 && donvi > 0) kq += ' linh'
  } else if (!laNhomDauTien && (chuc > 0 || donvi > 0)) {
    kq += 'không trăm'
    if (chuc === 0 && donvi > 0) kq += ' linh'
  }

  if (chuc >= 2) {
    kq += (kq ? ' ' : '') + CH_SO[chuc] + ' mươi'
    if      (donvi === 1) kq += ' mốt'
    else if (donvi === 5) kq += ' lăm'
    else if (donvi  >  0) kq += ' ' + CH_SO[donvi]
  } else if (chuc === 1) {
    kq += (kq ? ' ' : '') + 'mười'
    if      (donvi === 1) kq += ' một'
    else if (donvi === 5) kq += ' lăm'
    else if (donvi  >  0) kq += ' ' + CH_SO[donvi]
  } else if (donvi > 0) {
    kq += (kq ? ' ' : '') + CH_SO[donvi]
  }

  return kq
}

const HANG = ['', 'nghìn', 'triệu', 'tỷ']

export function soThanhChu(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '(không xác định)'
  n = Math.round(n)
  if (n === 0) return 'Không đồng'

  // Chia thành các nhóm 3 chữ số từ phải sang trái
  const nhoms: number[] = []
  let tmp = n
  while (tmp > 0) {
    nhoms.push(tmp % 1000)
    tmp = Math.floor(tmp / 1000)
  }

  let kq = ''
  for (let i = nhoms.length - 1; i >= 0; i--) {
    if (nhoms[i] === 0) continue
    const laDau = kq === ''
    const chu   = doc3So(nhoms[i], laDau)
    const hang  = HANG[i] ?? ''
    kq += (kq ? ' ' : '') + chu + (hang ? ' ' + hang : '')
  }

  // Viết hoa chữ đầu
  kq = kq.charAt(0).toUpperCase() + kq.slice(1)
  return kq + ' đồng'
}

/** Format số VNĐ với dấu chấm phân cách nghìn */
export function formatVnd(n: number): string {
  return n.toLocaleString('vi-VN') + ' vnđ'
}
