import { createServiceClient } from '@/lib/supabase/server'

interface NotificationPayload {
  type: string
  title: string
  body?: string
  link?: string
}

export async function createNotification(user_id: string, payload: NotificationPayload) {
  const service = createServiceClient()
  await service.from('notifications').insert({ user_id, ...payload })
}

// Gửi notification cho tất cả manager (admin/ceo/director) đang active
export async function notifyManagers(payload: NotificationPayload) {
  const service = createServiceClient()
  const { data: managers } = await service
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'ceo', 'director'])
    .eq('is_active', true)

  if (!managers?.length) return

  await service.from('notifications').insert(
    managers.map(m => ({ user_id: m.id, ...payload }))
  )
}
