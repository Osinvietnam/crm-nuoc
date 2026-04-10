import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const ROLES = ['admin', 'ceo', 'tech_lead', 'accountant', 'sales', 'tech', 'logistics', 'partner'] as const

const BASIC_FIELDS   = 'id, full_name, email, role, phone, chuc_vu, khu_vuc, trang_thai_nv'
const MINIMAL_FIELDS = 'id, full_name, email, role, phone, is_active, created_at'
const MANAGER_FIELDS = 'id, full_name, email, role, phone, chuc_vu, khu_vuc, ' +
  'target_thang, ngay_vao_lam, trang_thai_nv, is_active, created_at, ' +
  'ngay_sinh, dia_chi, cccd, so_tk_nh, ngan_hang, tinh_trang_hn, ghi_chu_nb'

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const isManager = ['admin', 'ceo'].includes(me.role)
    const isAdmin   = me.role === 'admin'
    const service   = createServiceClient()

    // Try extended fields first; fall back to basic if columns don't exist yet (pending migrations)
    let profiles: Record<string, unknown>[] | null = null
    if (isManager) {
      const { data, error } = await service
        .from('profiles')
        .select(MANAGER_FIELDS)
        .order('created_at', { ascending: true })
      if (!error) {
        profiles = data
      } else {
        console.warn('MANAGER_FIELDS query failed, falling back to BASIC_FIELDS:', error.message)
      }
    }
    if (profiles === null) {
      const { data, error } = await service
        .from('profiles')
        .select(BASIC_FIELDS)
        .order('created_at', { ascending: true })
      if (!error) {
        profiles = data
      } else {
        console.warn('BASIC_FIELDS query failed, falling back to MINIMAL_FIELDS:', error.message)
        const { data: data2, error: error2 } = await service
          .from('profiles')
          .select(MINIMAL_FIELDS)
          .order('created_at', { ascending: true })
        if (error2) throw error2
        profiles = data2
      }
    }

    return NextResponse.json({ data: profiles ?? [], isManager, isAdmin })
  } catch (err) {
    console.error('GET /api/admin/users:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/admin/users — Tạo user mới + gửi email mời ───────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ admin mới tạo được tài khoản' }, { status: 403 })
    }

    const body = await req.json()
    const {
      full_name, email, role, phone, chuc_vu, khu_vuc,
      target_thang, ngay_vao_lam, trang_thai_nv,
    } = body

    if (!full_name || !email || !role) {
      return NextResponse.json({ error: 'Họ tên, email và vai trò là bắt buộc' }, { status: 400 })
    }
    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 })
    }

    const service = createServiceClient()
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-nuoc.vercel.app'}/reset-password`

    // Tạo user + gửi email mời đặt mật khẩu
    const { data: invited, error: inviteErr } = await service.auth.admin.inviteUserByEmail(email, {
      data:       { full_name },
      redirectTo,
    })
    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 })
    }

    const newId = invited.user.id

    // Tạo profile
    const { error: profileErr } = await service.from('profiles').upsert({
      id:            newId,
      full_name,
      email,
      role,
      phone:         phone        || null,
      chuc_vu:       chuc_vu      || null,
      khu_vuc:       khu_vuc      || null,
      target_thang:  target_thang ? Number(target_thang) : null,
      ngay_vao_lam:  ngay_vao_lam || null,
      trang_thai_nv: trang_thai_nv || 'Đang làm',
      is_active:     true,
    })
    if (profileErr) throw profileErr

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'user_created',
      entity:    'user',
      detail:    `${full_name} (${email}) — ${role}`,
    })

    return NextResponse.json({ success: true, id: newId })
  } catch (err) {
    console.error('POST /api/admin/users:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/users — Cập nhật thông tin user ────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !['admin', 'ceo'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    // Chỉ admin mới được đổi role
    if ('role' in updates && me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ admin mới đổi được vai trò' }, { status: 403 })
    }
    if ('role' in updates && updates.role && !ROLES.includes(updates.role)) {
      return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 })
    }
    if (id === user.id && 'role' in updates) {
      return NextResponse.json({ error: 'Không thể đổi vai trò của chính mình' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data: before } = await service
      .from('profiles').select('full_name, role').eq('id', id).single()

    const { error } = await service.from('profiles').update(updates).eq('id', id)
    if (error) throw error

    // Nếu đổi sang Nghỉ việc → disable login
    if (updates.trang_thai_nv === 'Nghỉ việc') {
      await service.auth.admin.updateUserById(id, { ban_duration: '876600h' }) // ~100 năm
      await service.from('profiles').update({ is_active: false }).eq('id', id)
    }
    // Nếu đổi từ Nghỉ việc sang trạng thái khác → enable lại
    if (updates.trang_thai_nv && updates.trang_thai_nv !== 'Nghỉ việc') {
      await service.auth.admin.updateUserById(id, { ban_duration: 'none' })
      await service.from('profiles').update({ is_active: true }).eq('id', id)
    }

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'profile_updated',
      entity:    'user',
      detail:    `${before?.full_name ?? id}: ${JSON.stringify(updates)}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/admin/users:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
