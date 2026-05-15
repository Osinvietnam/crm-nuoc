import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity, type ActivityType } from '@/lib/activity'

// ─── GET /api/lark/customers/[id]/activities ──────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const customerId = /^\d+$/.test(id) ? parseInt(id) : null
    if (!customerId) return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 })

    const { data, error } = await supabase
      .from('customer_activities')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('GET activities:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/lark/customers/[id]/activities ─────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const customerId = /^\d+$/.test(id) ? parseInt(id) : null
    if (!customerId) return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 })

    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()

    const body = await req.json()
    const { type, content, meta } = body as { type: ActivityType; content?: string; meta?: Record<string, unknown> }

    if (!type) return NextResponse.json({ error: 'Thiếu type' }, { status: 400 })

    await logActivity(supabase, {
      customer_id: customerId,
      user_id:     user.id,
      user_name:   profile?.full_name ?? 'NV',
      type,
      content,
      meta,
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('POST activities:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
