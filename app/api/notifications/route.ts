import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/notifications?limit=20 — unread first ─────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20), 50)

    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, link, read_at, created_at')
      .eq('user_id', user.id)
      .order('read_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const unread_count = (data ?? []).filter(n => !n.read_at).length

    return NextResponse.json({ data: data ?? [], unread_count })
  } catch (err) {
    console.error('GET /api/notifications:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/notifications — đánh dấu tất cả đã đọc ─────────────────────

export async function PATCH() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/notifications:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
