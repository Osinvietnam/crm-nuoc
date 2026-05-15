import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── PATCH /api/warranty-tickets/[id] ────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const { id } = await params
    const body   = await req.json()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of ['trang_thai', 'mo_ta', 'priority', 'scheduled_date', 'scheduled_note']) {
      if (k in body) updates[k] = body[k] ?? null
    }
    if ('nguoi_xu_ly' in body) {
      updates.nguoi_xu_ly = body.nguoi_xu_ly || null
      // Resolve name
      if (body.nguoi_xu_ly) {
        const { data: handler } = await supabase
          .from('profiles').select('full_name').eq('id', body.nguoi_xu_ly).single()
        updates.nguoi_xu_ly_name = handler?.full_name ?? null
      } else {
        updates.nguoi_xu_ly_name = null
      }
    }

    const { data, error } = await supabase
      .from('warranty_tickets').update(updates).eq('id', parseInt(id))
      .select('*, customers(ho_ten), orders(ma_hd)').single()
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('PATCH /api/warranty-tickets/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/warranty-tickets/[id] ───────────────────────────────────────

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
    if (!['admin', 'ceo', 'director'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Không có quyền xóa' }, { status: 403 })
    }

    const { id } = await params
    const { error } = await supabase
      .from('warranty_tickets').delete().eq('id', parseInt(id))
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/warranty-tickets/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
