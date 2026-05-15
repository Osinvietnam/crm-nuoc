import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivityType =
  | 'call'
  | 'note'
  | 'contact_log'
  | 'pipeline_change'
  | 'quote_created'
  | 'order_created'
  | 'payment'
  | 'maintenance'
  | 'warranty'

export interface ActivityMeta {
  from?:    string
  to?:      string
  amount?:  number
  result?:  string
  [key: string]: unknown
}

export interface ActivityRecord {
  id:          number
  customer_id: number
  user_id:     string
  user_name:   string
  type:        ActivityType
  content:     string | null
  meta:        ActivityMeta | null
  created_at:  string
}

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  call:            '📞',
  note:            '📝',
  contact_log:     '📞',
  pipeline_change: '🔄',
  quote_created:   '📋',
  order_created:   '📄',
  payment:         '💰',
  maintenance:     '🔧',
  warranty:        '🛡️',
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call:            'Cuộc gọi',
  note:            'Ghi chú',
  contact_log:     'Liên hệ',
  pipeline_change: 'Cập nhật pipeline',
  quote_created:   'Tạo báo giá',
  order_created:   'Ký hợp đồng',
  payment:         'Thanh toán',
  maintenance:     'Bảo trì',
  warranty:        'Bảo hành',
}

/**
 * Ghi một activity cho khách hàng. Fire-and-forget (void) OK.
 */
export async function logActivity(
  supabase: SupabaseClient,
  params: {
    customer_id: number
    user_id:     string
    user_name:   string
    type:        ActivityType
    content?:    string
    meta?:       ActivityMeta
  }
): Promise<void> {
  const { error } = await supabase.from('customer_activities').insert({
    customer_id: params.customer_id,
    user_id:     params.user_id,
    user_name:   params.user_name,
    type:        params.type,
    content:     params.content ?? null,
    meta:        params.meta    ?? null,
  })
  if (error) console.error('logActivity:', error.message)
}
