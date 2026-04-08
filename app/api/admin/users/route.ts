import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const ROLES = ['admin', 'manager', 'sales', 'tech'] as const

// ─── GET /api/admin/users — Danh sách tất cả user ────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!me || !['admin', 'manager'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, phone, department, is_active, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data: profiles ?? [] })
  } catch (err) {
    console.error('GET /api/admin/users:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/users — Đổi role user (chỉ admin) ──────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    // Chỉ admin mới được đổi role
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ admin mới có thể thay đổi vai trò' }, { status: 403 })
    }

    const { id, role } = await req.json()

    if (!id || !role) {
      return NextResponse.json({ error: 'Thiếu id hoặc role' }, { status: 400 })
    }

    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: 'Role không hợp lệ' }, { status: 400 })
    }

    // Không cho tự đổi role của chính mình
    if (id === user.id) {
      return NextResponse.json({ error: 'Không thể thay đổi vai trò của chính mình' }, { status: 400 })
    }

    // Lấy tên target để ghi log
    const { data: target } = await supabase
      .from('profiles').select('full_name, role').eq('id', id).single()

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id)

    if (error) throw error

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'role_changed',
      entity:    'user',
      detail:    `${target?.full_name ?? id}: ${target?.role ?? '?'} → ${role}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/admin/users:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
