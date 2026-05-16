import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/customers/[id]/pipeline-history ─────────────────────────────────
// Trả về lịch sử pipeline của 1 khách hàng, có tên người thực hiện
// RLS kế thừa từ pipeline_history policy (chỉ thấy KH mình có quyền)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const customerId = parseInt(id)
    if (isNaN(customerId)) return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 })

    // Join với profiles để lấy tên người thực hiện
    const { data, error } = await supabase
      .from('pipeline_history')
      .select(`
        id,
        from_stage,
        to_stage,
        changed_at,
        notes,
        changed_by,
        profiles:changed_by ( full_name )
      `)
      .eq('customer_id', customerId)
      .order('changed_at', { ascending: false })
      .limit(50)

    if (error) throw error

    // Flatten profile join
    const history = (data ?? []).map(row => ({
      id:          row.id,
      from_stage:  row.from_stage,
      to_stage:    row.to_stage,
      changed_at:  row.changed_at,
      notes:       row.notes,
      changed_by:  row.changed_by,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      changed_by_name: (row.profiles as any)?.full_name ?? null,
    }))

    return NextResponse.json({ history })
  } catch (err) {
    console.error('GET /api/customers/[id]/pipeline-history:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
