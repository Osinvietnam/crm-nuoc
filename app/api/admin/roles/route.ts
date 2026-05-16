import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// ─── GET /api/admin/roles — Ma trận role × permission ────────────────────────
// Trả về tất cả roles + permissions, kết hợp thành matrix cho UI checkbox

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    // Load roles + permissions trong 2 query song song
    const [rolesRes, permsRes] = await Promise.all([
      supabase
        .from('roles')
        .select('id, code, display_name, description, is_system, is_active, sort_order')
        .order('sort_order'),
      supabase
        .from('role_permissions')
        .select('role_id, permission_key, is_enabled'),
    ])

    if (rolesRes.error) throw rolesRes.error
    if (permsRes.error) throw permsRes.error

    // Build matrix: { [role_id]: { [permission_key]: boolean } }
    const matrix: Record<number, Record<string, boolean>> = {}
    for (const p of (permsRes.data ?? [])) {
      if (!matrix[p.role_id]) matrix[p.role_id] = {}
      matrix[p.role_id][p.permission_key] = p.is_enabled
    }

    // Gắn permissions vào từng role
    const roles = (rolesRes.data ?? []).map(r => ({
      ...r,
      permissions: matrix[r.id] ?? {},
    }))

    return NextResponse.json({ roles })
  } catch (err) {
    console.error('GET /api/admin/roles:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/roles — Toggle permission cho 1 role ───────────────────
// Body: { role_id, permission_key, is_enabled }
// Hoặc batch: { updates: [{ role_id, permission_key, is_enabled }] }

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ Admin mới được thay đổi phân quyền' }, { status: 403 })
    }

    const body = await req.json()

    // Support single hoặc batch update
    const updates: { role_id: number; permission_key: string; is_enabled: boolean }[] =
      body.updates ?? [body]

    if (!updates.length) {
      return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 })
    }

    // Validate không cho tắt quyền hệ thống của admin
    const adminRoleRes = await supabase
      .from('roles').select('id').eq('code', 'admin').single()
    const adminId = adminRoleRes.data?.id

    for (const u of updates) {
      if (u.role_id === adminId && !u.is_enabled) {
        // Vẫn cho phép nhưng log warning — không hard-block để linh hoạt
        console.warn(`[WARN] Admin đang tắt quyền ${u.permission_key} cho role admin`)
      }
    }

    const svc = createServiceClient()
    const { error } = await svc
      .from('role_permissions')
      .upsert(
        updates.map(u => ({
          role_id:        u.role_id,
          permission_key: u.permission_key,
          is_enabled:     u.is_enabled,
          updated_at:     new Date().toISOString(),
        })),
        { onConflict: 'role_id,permission_key' }
      )

    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? user.email ?? '',
      action:    'role_changed',
      entity:    'user',
      detail:    `Role permissions updated: ${updates.length} change(s)`,
    })

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (err) {
    console.error('PATCH /api/admin/roles:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/admin/roles — E3: Clone toàn bộ permissions từ 1 role sang role khác ──

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ Admin mới clone được role permissions' }, { status: 403 })
    }

    const body = await req.json()
    const { from_role, to_role } = body
    if (!from_role || !to_role || from_role === to_role) {
      return NextResponse.json({ error: 'Cần from_role và to_role khác nhau' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Lấy role IDs
    const { data: roleRows } = await svc
      .from('roles').select('id, code').in('code', [from_role, to_role])

    const fromId = roleRows?.find(r => r.code === from_role)?.id
    const toId   = roleRows?.find(r => r.code === to_role)?.id
    if (!fromId || !toId) {
      return NextResponse.json({ error: 'Role không tồn tại' }, { status: 404 })
    }

    // Lấy permissions của from_role
    const { data: fromPerms } = await svc
      .from('role_permissions').select('permission_key, is_enabled').eq('role_id', fromId)

    if (!fromPerms?.length) {
      return NextResponse.json({ error: 'Role nguồn chưa có permission nào' }, { status: 400 })
    }

    // Upsert vào to_role
    const upsertRows = fromPerms.map(p => ({
      role_id:        toId,
      permission_key: p.permission_key,
      is_enabled:     p.is_enabled,
    }))

    const { error } = await svc
      .from('role_permissions')
      .upsert(upsertRows, { onConflict: 'role_id,permission_key' })
    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? '',
      action:    'role_changed',
      entity:    'user',
      detail:    `Clone role permissions: ${from_role} → ${to_role} (${fromPerms.length} quyền)`,
    })

    return NextResponse.json({ success: true, copied: fromPerms.length })
  } catch (err) {
    console.error('POST /api/admin/roles:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
