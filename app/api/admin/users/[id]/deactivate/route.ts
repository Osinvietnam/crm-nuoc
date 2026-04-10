export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listAllRecords, batchUpdateRecords } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'
import { logAudit } from '@/lib/audit'

// Các bảng LarkBase có trường "Người phụ trách" cần gán lại
const TABLES_WITH_ASSIGNEE = [
  TABLES.CUSTOMERS,
  TABLES.QUOTES,
  TABLES.CONTRACTS,
  TABLES.COMMERCIAL,
  TABLES.PROJECTS,
] as const

// Chia mảng thành các chunk tối đa 500 record (giới hạn Lark batch API)
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── POST /api/admin/users/[id]/deactivate ────────────────────────────────────
// Body: { new_owner_name: string, new_owner_id: string }
// 1. Gán lại tất cả KH + đơn hàng sang new_owner trên LarkBase
// 2. Set is_active = false trong Supabase profiles

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Chỉ admin
    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ admin mới có thể khoá tài khoản' }, { status: 403 })
    }

    const { id: targetId } = await params
    const { new_owner_name, new_owner_id } = await req.json()

    if (!new_owner_name || !new_owner_id) {
      return NextResponse.json({ error: 'Thiếu thông tin người nhận bàn giao' }, { status: 400 })
    }

    // Không cho tự khoá mình
    if (targetId === user.id) {
      return NextResponse.json({ error: 'Không thể khoá tài khoản của chính mình' }, { status: 400 })
    }

    // Lấy thông tin user cần khoá
    const { data: target } = await supabase
      .from('profiles')
      .select('full_name, is_active')
      .eq('id', targetId)
      .single()

    if (!target) {
      return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 })
    }

    if (!target.is_active) {
      return NextResponse.json({ error: 'Tài khoản này đã bị khoá' }, { status: 400 })
    }

    const oldName = target.full_name
    const reassignSummary: Record<string, number> = {}

    // ── Gán lại trên LarkBase ─────────────────────────────────────────────────
    for (const tableId of TABLES_WITH_ASSIGNEE) {
      try {
        const records = await listAllRecords(
          tableId,
          `CurrentValue.[Người phụ trách] = "${oldName}"`
        )

        if (records.length === 0) {
          reassignSummary[tableId] = 0
          continue
        }

        // Batch update theo chunk 500
        const batches = chunk(records, 500)
        for (const batch of batches) {
          await batchUpdateRecords(
            tableId,
            batch.map(r => ({
              record_id: r.record_id,
              fields: { 'Người phụ trách': new_owner_name },
            }))
          )
        }

        reassignSummary[tableId] = records.length
      } catch (larkErr) {
        // Không để lỗi 1 bảng chặn toàn bộ quá trình
        console.error(`Reassign error on table ${tableId}:`, larkErr)
        reassignSummary[tableId] = -1 // -1 = lỗi
      }
    }

    // ── Khoá tài khoản trên Supabase ─────────────────────────────────────────
    const { error: deactivateErr } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', targetId)

    if (deactivateErr) throw deactivateErr

    // Lấy thông tin admin thực hiện để ghi log
    const { data: adminProfile } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: adminProfile?.full_name ?? user.id,
      action:    'user_deactivated',
      entity:    'user',
      detail:    `Khoá "${oldName}" → bàn giao cho "${new_owner_name}"`,
    })

    return NextResponse.json({
      success:  true,
      reassign: reassignSummary,
      message:  `Đã khoá tài khoản ${oldName} và bàn giao cho ${new_owner_name}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/admin/users/[id]/deactivate:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
