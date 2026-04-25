import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/admin/task-definitions?stage= ──────────────────────────────────
// stage: optional — nếu có thì filter theo stage_code

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Tất cả authenticated đều đọc được (dùng cho checklist UI)
    const stage      = req.nextUrl.searchParams.get('stage')
    const activeOnly = req.nextUrl.searchParams.get('active_only') !== 'false'

    let query = supabase
      .from('task_definitions')
      .select('*')
      .order('stage_code')
      .order('sort_order')

    if (stage)      query = query.eq('stage_code', stage)
    if (activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ tasks: data ?? [] })
  } catch (err) {
    console.error('GET /api/admin/task-definitions:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/admin/task-definitions — Tạo task mới ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ Admin mới được thêm task' }, { status: 403 })
    }

    const body = await req.json()
    const {
      stage_code, stage_label, task_key, label, bo_phan,
      task_type = 'mandatory', requires_attachment = false,
      order_types = ['B2C', 'Thuong_mai', 'Du_an'],
      roles_can_update, roles_can_approve, sort_order = 0,
    } = body

    if (!stage_code || !task_key || !label || !bo_phan) {
      return NextResponse.json({
        error: 'Bắt buộc: stage_code, task_key, label, bo_phan',
      }, { status: 400 })
    }
    if (!roles_can_update?.length || !roles_can_approve?.length) {
      return NextResponse.json({
        error: 'Cần khai báo roles_can_update và roles_can_approve',
      }, { status: 400 })
    }

    const svc = createServiceClient()
    const { data, error } = await svc
      .from('task_definitions')
      .insert({
        stage_code, stage_label: stage_label ?? stage_code,
        task_key, label, bo_phan, task_type,
        requires_attachment, order_types,
        roles_can_update, roles_can_approve, sort_order,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `task_key "${task_key}" đã tồn tại` }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ task: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/task-definitions:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/task-definitions?id= — Cập nhật task ───────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ Admin mới được chỉnh task' }, { status: 403 })
    }

    const id   = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    const body = await req.json()
    // Cho phép cập nhật các fields này
    const allowed = [
      'label', 'bo_phan', 'task_type', 'requires_attachment',
      'order_types', 'roles_can_update', 'roles_can_approve',
      'sort_order', 'is_active',
    ]
    const patch: Record<string, any> = {}
    for (const k of allowed) {
      if (k in body) patch[k] = body[k]
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 })
    }

    const svc = createServiceClient()
    const { data, error } = await svc
      .from('task_definitions')
      .update(patch)
      .eq('id', Number(id))
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ task: data })
  } catch (err) {
    console.error('PATCH /api/admin/task-definitions:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/admin/task-definitions?id= — Soft delete (is_active=false) ──

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ Admin mới được xóa task' }, { status: 403 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    // Soft delete: is_active = false (không xóa thật để giữ lịch sử)
    const svc = createServiceClient()
    const { error } = await svc
      .from('task_definitions')
      .update({ is_active: false })
      .eq('id', Number(id))

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/task-definitions:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
