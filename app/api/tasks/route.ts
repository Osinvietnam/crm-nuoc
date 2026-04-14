import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/tasks?customer_record_id=&stage= ───────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const customer_record_id = req.nextUrl.searchParams.get('customer_record_id')
    const stage = req.nextUrl.searchParams.get('stage')

    if (!customer_record_id) {
      return NextResponse.json({ error: 'Thiếu customer_record_id' }, { status: 400 })
    }

    const service = createServiceClient()
    let query = service
      .from('task_completions')
      .select('*')
      .eq('customer_record_id', customer_record_id)
      .order('completed_at', { ascending: true })

    if (stage) query = query.eq('stage', stage)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('GET /api/tasks:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/tasks — Tick task (upsert) ────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const body = await req.json()
    const { customer_record_id, stage, task_key, notes } = body

    if (!customer_record_id || !stage || !task_key) {
      return NextResponse.json({ error: 'Thiếu customer_record_id, stage hoặc task_key' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('task_completions')
      .upsert({
        customer_record_id,
        stage,
        task_key,
        completed_by:      user.id,
        completed_by_name: (me.full_name as string | null) ?? (user.email ?? ''),
        completed_at:      new Date().toISOString(),
        notes:             notes ?? null,
      }, {
        onConflict: 'customer_record_id,stage,task_key',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('POST /api/tasks:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/tasks?id= — Bỏ tick task ────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    const service = createServiceClient()

    // Admin/CEO có thể xóa bất kỳ; role khác chỉ xóa task của mình
    const isManager = ['admin', 'ceo'].includes(me.role)
    let query = service.from('task_completions').delete().eq('id', id)
    if (!isManager) query = query.eq('completed_by', user.id)

    const { error } = await query
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/tasks:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
