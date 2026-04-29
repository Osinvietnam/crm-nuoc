import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// ─── POST /api/profile/password — NV tự đổi mật khẩu ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { new_password } = await req.json()
    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 8 ký tự' }, { status: 400 })
    }

    // Dùng session của user hiện tại — không cần service role
    const { error } = await supabase.auth.updateUser({ password: new_password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const { data: me } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    void logAudit(supabase, { user_id: user.id, user_name: me?.full_name ?? '', action: 'password_reset', entity: 'user', detail: 'Tự đổi mật khẩu' })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/profile/password:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
