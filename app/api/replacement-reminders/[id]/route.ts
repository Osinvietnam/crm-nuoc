import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── PATCH /api/replacement-reminders/[id] ───────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'ceo', 'director', 'sales'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const allowed: Record<string, unknown> = {}
    const updatable = ['ngay_nhac_tiep', 'is_done', 'assigned_to', 'ghi_chu']
    for (const key of updatable) {
      if (key in body) allowed[key] = body[key]
    }

    if (body.is_done === true && !('done_at' in allowed)) {
      allowed.done_at = new Date().toISOString()
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Không có trường nào để cập nhật' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('replacement_reminders')
      .update(allowed)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('PATCH /api/replacement-reminders/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/replacement-reminders/[id] ──────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'ceo', 'director', 'sales'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const { error } = await supabase
      .from('replacement_reminders')
      .delete()
      .eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/replacement-reminders/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
