import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'

// ─── GET /api/admin/permissions?userId= ──────────────────────────────────────
// Trả về quyền hiện tại của một user + role default để so sánh

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 })

    const service = createServiceClient()

    const [profileRes, userPermsRes] = await Promise.all([
      service.from('profiles').select('id, full_name, role').eq('id', userId).single(),
      service.from('user_permissions')
        .select('permission_key, is_enabled')
        .eq('user_id', userId),
    ])

    if (profileRes.error) return NextResponse.json({ error: 'User không tồn tại' }, { status: 404 })

    const profile = profileRes.data
    const userPerms: Record<string, boolean> = {}
    for (const p of (userPermsRes.data ?? [])) {
      userPerms[p.permission_key] = p.is_enabled
    }

    // Lấy role default để so sánh
    const { data: rolePerms } = await service
      .from('role_permissions')
      .select('permission_key, is_enabled')
      .eq('role_id',
        (await service.from('roles').select('id').eq('code', profile.role).single()).data?.id ?? 0
      )

    const roleDefaults: Record<string, boolean> = {}
    for (const p of (rolePerms ?? [])) {
      roleDefaults[p.permission_key] = p.is_enabled
    }

    return NextResponse.json({
      profile,
      permissions: userPerms,
      role_defaults: roleDefaults,
    })
  } catch (err) {
    console.error('GET /api/admin/permissions:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/permissions — Cập nhật quyền của 1 user ────────────────
// Body: { userId, updates: [{ permission_key, is_enabled }] }

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ Admin mới thay đổi được quyền' }, { status: 403 })
    }

    const body = await req.json()
    const { userId, updates } = body as {
      userId: string
      updates: { permission_key: string; is_enabled: boolean }[]
    }

    if (!userId || !updates?.length) {
      return NextResponse.json({ error: 'Thiếu userId hoặc updates' }, { status: 400 })
    }

    // E4: Rate limit — 30 permission updates per admin per minute
    if (!rateLimit(`${user.id}:perm_update`, 30)) {
      return NextResponse.json({ error: 'Cập nhật quyền quá nhanh. Vui lòng thử lại sau.' }, { status: 429 })
    }

    const service = createServiceClient()

    // Upsert từng permission
    const rows = updates.map(u => ({
      user_id:        userId,
      permission_key: u.permission_key,
      is_enabled:     u.is_enabled,
      updated_at:     new Date().toISOString(),
    }))

    const { error } = await service
      .from('user_permissions')
      .upsert(rows, { onConflict: 'user_id,permission_key' })
    if (error) throw error

    const { data: target } = await service
      .from('profiles').select('full_name, role').eq('id', userId).single()

    const enabled  = updates.filter(u => u.is_enabled).map(u => u.permission_key)
    const disabled = updates.filter(u => !u.is_enabled).map(u => u.permission_key)
    const parts = []
    if (enabled.length)  parts.push(`bật: ${enabled.join(', ')}`)
    if (disabled.length) parts.push(`tắt: ${disabled.join(', ')}`)
    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'permissions_updated',
      entity:    'user',
      detail:    `[${target?.full_name ?? userId}] (${target?.role ?? '?'}): ${parts.join(' | ')}`,
      before:    { permissions: disabled },
      after:     { permissions: enabled },
    })

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (err) {
    console.error('PATCH /api/admin/permissions:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/admin/permissions?userId= — Reset về mặc định role ──────────

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ Admin mới thao tác được' }, { status: 403 })
    }

    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 })

    const service = createServiceClient()

    // Lấy role của user
    const { data: profile } = await service
      .from('profiles').select('role, full_name').eq('id', userId).single()
    if (!profile) return NextResponse.json({ error: 'User không tồn tại' }, { status: 404 })

    // Xóa permissions cũ và seed lại từ role
    await service.from('user_permissions').delete().eq('user_id', userId)

    const { data: roleRow } = await service
      .from('roles').select('id').eq('code', profile.role).single()
    if (roleRow) {
      const { data: rolePerms } = await service
        .from('role_permissions').select('permission_key, is_enabled').eq('role_id', roleRow.id)
      if (rolePerms?.length) {
        await service.from('user_permissions').insert(
          rolePerms.map(p => ({
            user_id:        userId,
            permission_key: p.permission_key,
            is_enabled:     p.is_enabled,
          }))
        )
      }
    }

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'permissions_reset',
      entity:    'user',
      detail:    `${profile.full_name}: reset về mặc định role ${profile.role}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/permissions:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
