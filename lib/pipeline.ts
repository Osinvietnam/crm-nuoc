import type { SupabaseClient } from '@supabase/supabase-js'

export const PIPELINE_ORDER = [
  'Lead mới', 'Tiềm năng', 'Báo giá', 'Đàm phán',
  'Chốt HĐ', 'Giao hàng', 'Nghiệm thu', 'Bảo hành', 'Bảo trì',
] as const

export type PipelineStage = (typeof PIPELINE_ORDER)[number]

/**
 * Advance customer pipeline — chỉ cập nhật nếu stage mới CAO HƠN hiện tại.
 * Không bao giờ đẩy pipeline lùi.
 */
export async function advanceCustomerPipeline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  customerId: number | string,
  newStage: string,
) {
  const idx = PIPELINE_ORDER.indexOf(newStage as PipelineStage)
  if (idx <= 0) return
  const stagesBelow = PIPELINE_ORDER.slice(0, idx) as unknown as string[]
  await supabase
    .from('customers')
    .update({ pipeline: newStage })
    .eq('id', customerId)
    .in('pipeline', stagesBelow)
}
