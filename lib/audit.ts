import type { SupabaseClient } from '@supabase/supabase-js'

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
  | 'quote_status_changed'
  | 'password_reset'
  | 'payment_created'
  | 'payment_updated'
  | 'payment_deleted'
  | 'kpi_target_set'

export type AuditEntity = 'user' | 'company_settings' | 'quote' | 'system_config' | 'payment' | 'kpi'

export async function logAudit(
  supabase: SupabaseClient,
  opts: {
    user_id:   string
    user_name: string
    action:    AuditAction
    entity:    AuditEntity
    detail:    string
  }
): Promise<void> {
  await supabase.from('audit_logs').insert({
    user_id:   opts.user_id,
    user_name: opts.user_name,
    action:    opts.action,
    entity:    opts.entity,
    detail:    opts.detail,
  }).then(({ error }) => {
    if (error) console.error('audit log error:', error.message)
  })
}
