/**
 * Customer Health Score — tính từ data có sẵn, không cần migration
 *
 * Thang điểm 0–100:
 *  30pt  Ngày liên hệ gần nhất
 *  25pt  Pipeline stage
 *  25pt  Thanh toán (dùng tổng đợt đã trả / tổng đợt cần trả)
 *  20pt  Không có ticket bảo hành mở (passed in từ caller)
 */

export interface HealthInput {
  /** ms timestamp của lần liên hệ gần nhất */
  ngay_cap_nhat:    number | null
  /** Pipeline stage hiện tại */
  pipeline:         string
  /** Số đợt thanh toán đã hoàn thành (0–3) */
  paid_installments?: number
  /** Số ticket bảo hành đang mở */
  open_tickets?: number
}

export interface HealthScore {
  score:  number       // 0–100
  label:  '🟢 Tốt' | '🟡 Cần chú ý' | '🔴 Nguy cơ'
  color:  string       // Tailwind text class
  bgColor: string      // Tailwind bg class
}

const PIPELINE_SCORE: Record<string, number> = {
  'Lead mới':   5,
  'Tiềm năng': 10,
  'Báo giá':   13,
  'Đàm phán':  16,
  'Chốt HĐ':  20,
  'Giao hàng': 21,
  'Nghiệm thu':22,
  'Bảo hành':  24,
  'Bảo trì':   25,
  'Lost':        0,
}

export function computeHealthScore(input: HealthInput): HealthScore {
  const now = Date.now()

  // ── 30pt: Ngày liên hệ ───────────────────────────────────────────────────
  let contactPt = 0
  if (input.ngay_cap_nhat) {
    const days = (now - input.ngay_cap_nhat) / 86_400_000
    if      (days <= 7)  contactPt = 30
    else if (days <= 30) contactPt = 20
    else if (days <= 90) contactPt = 10
    // > 90 ngày = 0
  }

  // ── 25pt: Pipeline stage ─────────────────────────────────────────────────
  const stagePt = PIPELINE_SCORE[input.pipeline] ?? 5

  // ── 25pt: Thanh toán ─────────────────────────────────────────────────────
  const paid   = Math.min(input.paid_installments ?? 0, 3)
  const payPt  = Math.round((paid / 3) * 25)

  // ── 20pt: Không có ticket mở ─────────────────────────────────────────────
  const tickets = input.open_tickets ?? 0
  let ticketPt = 0
  if      (tickets === 0) ticketPt = 20
  else if (tickets <= 2)  ticketPt = 10
  // >= 3 = 0

  const score = Math.min(100, contactPt + stagePt + payPt + ticketPt)

  if (score >= 70) return { score, label: '🟢 Tốt',        color: 'text-green-600',  bgColor: 'bg-green-50' }
  if (score >= 40) return { score, label: '🟡 Cần chú ý',  color: 'text-yellow-600', bgColor: 'bg-yellow-50' }
  return              { score, label: '🔴 Nguy cơ',     color: 'text-red-600',    bgColor: 'bg-red-50' }
}
