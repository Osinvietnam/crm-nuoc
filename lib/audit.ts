import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

export type AuditAction =
  | 'role_changed'
  | 'user_deactivated'
  | 'user_reactivated'
  | 'user_created'
  | 'user_offboarded'
  | 'profile_updated'
  | 'settings_updated'
  | 'logo_updated'
  | 'logo_deleted'
  | 'quote_created'
  | 'quote_status_changed'
  | 'quote_duplicated'
  | 'password_reset'
  | 'payment_created'
  | 'payment_updated'
  | 'payment_deleted'
  | 'kpi_target_set'
  | 'permissions_updated'
  | 'permissions_reset'
  | 'customer_created'
  | 'customer_updated'
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'commission_paid'
  | 'commission_unpaid'
  | 'task_started'
  | 'task_updated'
  | 'task_reset'
  | 'order_updated'
  | 'order_created'

export type AuditEntity = 'user' | 'company_settings' | 'quote' | 'system_config' | 'payment' | 'kpi' | 'customer' | 'expense' | 'commission' | 'task' | 'order'

export async function logAudit(
  _supabase: SupabaseClient,
  opts: {
    user_id:   string
    user_name: string
    action:    AuditAction
    entity:    AuditEntity
    detail:    string
  }
): Promise<void> {
  const service = createServiceClient()
  await service.from('audit_logs').insert({
    user_id:   opts.user_id,
    user_name: opts.user_name,
    action:    opts.action,
    entity:    opts.entity,
    detail:    opts.detail,
  }).then(({ error }) => {
    if (error) console.error('audit log error:', error.message)
  })
}
