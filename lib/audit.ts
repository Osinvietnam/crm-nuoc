import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction =
  | 'role_changed'
  | 'user_deactivated'
  | 'user_reactivated'
  | 'settings_updated'
  | 'logo_updated'
  | 'logo_deleted'
  | 'quote_status_changed'
  | 'password_reset'

export type AuditEntity = 'user' | 'company_settings' | 'quote' | 'system_config'

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
