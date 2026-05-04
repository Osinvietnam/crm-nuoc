import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// POST /api/admin/users/[id]/reset-password — chỉ admin + ceo

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Chỉ admin/CEO/Director mới có thể đặt lại mật khẩu' }, { status: 403 })
    }

    const { id } = await params
    const { password } = await req.json()

    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 8 ký tự' }, { status: 400 })
    }

    if (id === user.id) {
      return NextResponse.json({ error: 'Không thể reset mật khẩu của chính mình' }, { status: 400 })
    }

    const { data: target } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', id)
      .single()

    const { error } = await supabase.auth.admin.updateUserById(id, { password })
    if (error) throw error

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'password_reset',
      entity:    'user',
      detail:    `Đặt lại mật khẩu cho ${target?.full_name ?? id}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/admin/users/[id]/reset-password:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
