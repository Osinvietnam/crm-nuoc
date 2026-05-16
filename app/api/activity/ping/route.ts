import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Session timeout: nếu không ping trong 15 phút → session coi như kết thúc
const TIMEOUT_MIN = 15

// ─── POST /api/activity/ping — Heartbeat từ dashboard layout ─────────────────
// Mọi authenticated user gọi được.
// Gọi mỗi 5 phút khi tab visible từ app/dashboard/layout.tsx

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    // Lấy tên + role (cần ghi vào session record)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()
    if (!profile) return NextResponse.json({ ok: false }, { status: 403 })

    const svc     = createServiceClient()
    const now     = new Date().toISOString()
    const cutoff  = new Date(Date.now() - TIMEOUT_MIN * 60 * 1000).toISOString()

    // Tìm session đang mở chưa timeout
    const { data: active } = await svc
      .from('user_sessions')
      .select('id')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .gte('last_ping_at', cutoff)
      .order('last_ping_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (active) {
      // Extend session đang mở
      await svc
        .from('user_sessions')
        .update({ last_ping_at: now })
        .eq('id', active.id)
    } else {
      // Đóng các session cũ còn mở (stale — timeout)
      await svc
        .from('user_sessions')
        .update({ ended_at: now })
        .eq('user_id', user.id)
        .is('ended_at', null)

      // Mở session mới
      await svc.from('user_sessions').insert({
        user_id:   user.id,
        user_name: profile.full_name ?? '',
        role:      profile.role      ?? '',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/activity/ping:', err)
    // Trả ok:false nhưng không 500 — ping failure không được ảnh hưởng UX
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
