import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/admin/users/[id]/offboard
 * 1. Chuyển tất cả KH (nguoi_phu_trach) sang CEO trong Supabase
 * 2. Set trang_thai_nv = 'Nghỉ việc', is_active = false
 * 3. Ban Supabase Auth account
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const service = createServiceClient()

    // Lấy thông tin NV sắp offboard
    const { data: target } = await service
      .from('profiles')
      .select('full_name, role, trang_thai_nv')
      .eq('id', id)
      .single()

    if (!target) return NextResponse.json({ error: 'Không tìm thấy nhân viên' }, { status: 404 })
    if (target.trang_thai_nv === 'Nghỉ việc') {
      return NextResponse.json({ error: 'Nhân viên đã ở trạng thái Nghỉ việc' }, { status: 400 })
    }

    // Tìm người nhận bàn giao theo thứ tự: CEO → Director → Admin
    const { data: allManagers } = await service
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['ceo', 'director', 'admin'])
      .eq('is_active', true)
      .neq('id', id)  // không phải chính người đang offboard

    const receiver = allManagers?.find(p => p.role === 'ceo')
      ?? allManagers?.find(p => p.role === 'director')
      ?? allManagers?.find(p => p.role === 'admin')

    if (!receiver) {
      return NextResponse.json(
        { error: 'Không tìm thấy người nhận bàn giao (cần ít nhất 1 CEO/Director/Admin đang active)' },
        { status: 400 }
      )
    }

    // Chuyển tất cả KH trong Supabase về receiver
    const { data: updated } = await service
      .from('customers')
      .update({ nguoi_phu_trach: receiver.id })
      .eq('nguoi_phu_trach', id)
      .select('id')
    const transferred = updated?.length ?? 0

    // Reassign tasks đang active
    const { data: reassignedTasks } = await service
      .from('tasks')
      .update({ assigned_to: receiver.id })
      .eq('assigned_to', id)
      .in('trang_thai', ['Chờ xử lý', 'Đang làm'])
      .select('id')
    const tasksTransferred = reassignedTasks?.length ?? 0

    // Reassign maintenance construction chưa hoàn thành
    const { data: reassignedMaintenance } = await service
      .from('maintenance_construction')
      .update({ ktv_phu_trach: receiver.id })
      .eq('ktv_phu_trach', id)
      .neq('trang_thai', 'Nghiệm thu hoàn thành')
      .select('id')
    const maintenanceTransferred = reassignedMaintenance?.length ?? 0

    // Disable Supabase Auth (ban ~100 năm)
    await service.auth.admin.updateUserById(id, { ban_duration: '876600h' })

    // Cập nhật profile
    await service.from('profiles').update({
      trang_thai_nv: 'Nghỉ việc',
      is_active:     false,
    }).eq('id', id)

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'user_offboarded',
      entity:    'user',
      detail:    `${target.full_name} → bàn giao cho ${receiver.full_name}: ${transferred} KH, ${tasksTransferred} tasks, ${maintenanceTransferred} CT lắp đặt`,
    })

    return NextResponse.json({
      success: true,
      transferred,
      tasksTransferred,
      maintenanceTransferred,
      receiverName: receiver.full_name
    })
  } catch (err) {
    console.error('POST offboard:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
