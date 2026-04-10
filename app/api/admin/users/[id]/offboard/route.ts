import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { updateRecord, listAllRecords } from '@/lib/lark/client'
import { revalidateTag } from 'next/cache'
import { TABLES } from '@/lib/lark/tables'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/admin/users/[id]/offboard
 * 1. Tìm tất cả KH của NV này trên LarkBase
 * 2. Chuyển "Người phụ trách" → full_name của CEO
 * 3. Set trang_thai_nv = 'Nghỉ việc', is_active = false
 * 4. Ban Supabase Auth account
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
    if (!me || !['admin', 'ceo'].includes(me.role)) {
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

    // Lấy full_name của CEO để chuyển KH
    const { data: ceoProfile } = await service
      .from('profiles').select('full_name').eq('role', 'ceo').single()
    const ceoName = ceoProfile?.full_name ?? me.full_name // fallback về người thực hiện

    // Tìm KH trên LarkBase thuộc NV này
    let transferred = 0
    try {
      const filter = `CurrentValue.[Người phụ trách] = "${target.full_name}"`
      const records = await listAllRecords(TABLES.CUSTOMERS, filter)

      // Cập nhật từng record (batch nếu nhiều)
      await Promise.all(
        records.map(r =>
          updateRecord(TABLES.CUSTOMERS, r.record_id, {
            'Người phụ trách': ceoName,
          }).catch(() => null)
        )
      )
      transferred = records.length
      revalidateTag('lark-customers', 'max')
    } catch {
      // LarkBase lỗi không block offboarding
    }

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
      detail:    `${target.full_name} — chuyển ${transferred} KH sang ${ceoName}`,
    })

    return NextResponse.json({ success: true, transferred, ceoName })
  } catch (err) {
    console.error('POST offboard:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
