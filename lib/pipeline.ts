import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Fallback order — dùng khi DB unavailable ─────────────────────────────────
// Là union của tất cả stages: B2C + Thuong_mai + Du_an theo thứ tự đầy đủ nhất
export const PIPELINE_ORDER = [
  'Lead mới', 'Tiềm năng', 'Báo giá', 'Đàm phán', 'Hồ sơ thầu',
  'Chốt HĐ', 'Giao hàng', 'Nghiệm thu', 'Bảo hành', 'Bảo trì', 'Lost',
] as const

export type PipelineStage = (typeof PIPELINE_ORDER)[number]

// ─── Lấy thứ tự stages từ DB — resilient to label rename ─────────────────────
/**
 * Build ordered union của tất cả stage_labels từ các pipeline_configs đang active.
 * Nếu DB fail → fallback về PIPELINE_ORDER (hardcode).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLabelOrder(supabase: SupabaseClient<any, any, any>): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('pipeline_configs')
      .select('stage_labels, order_type')
      .eq('is_active', true)
      .order('order_type')   // B2C, Du_an, Thuong_mai — stable order

    if (!data?.length) return [...PIPELINE_ORDER]

    // Union có thứ tự: ưu tiên Thuong_mai (đầy đủ nhất cho KH lifecycle)
    // sau đó Du_an (có Hồ sơ thầu), sau đó B2C
    const priority = ['Thuong_mai', 'Du_an', 'B2C']
    const sorted = [...data].sort((a, b) =>
      (priority.indexOf(a.order_type) + 1 || 99) - (priority.indexOf(b.order_type) + 1 || 99)
    )

    const seen  = new Set<string>()
    const order: string[] = []
    for (const cfg of sorted) {
      for (const label of (cfg.stage_labels as string[])) {
        if (!seen.has(label)) { seen.add(label); order.push(label) }
      }
    }
    // 'Lost' luôn là terminal stage cuối
    if (!seen.has('Lost')) order.push('Lost')
    return order
  } catch {
    return [...PIPELINE_ORDER]
  }
}

// ─── Advance pipeline — forward-only ─────────────────────────────────────────
/**
 * Cập nhật pipeline KH lên stage mới — CHỈ nếu stage mới cao hơn hiện tại.
 * Thứ tự stages lấy từ DB (resilient to label rename), fallback về PIPELINE_ORDER.
 * 'Lost' là terminal stage — chỉ set thủ công, không bao giờ advance tự động.
 */
export async function advanceCustomerPipeline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  customerId: number | string,
  newStage: string,
) {
  if (newStage === 'Lost') return

  const order = await getLabelOrder(supabase)
  const idx   = order.indexOf(newStage)
  if (idx <= 0) return   // không tìm thấy hoặc là stage đầu tiên

  const stagesBelow = order.slice(0, idx)
  await supabase
    .from('customers')
    .update({ pipeline: newStage })
    .eq('id', customerId)
    .in('pipeline', stagesBelow)
}
