import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── PATCH /api/order-warranties/[id] ────────────────────────────────────────

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
    if (!['admin', 'ceo', 'director'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Không có quyền cập nhật' }, { status: 403 })
    }

    const { id } = await params
    const body   = await req.json()
    const updates: Record<string, unknown> = {}
    for (const k of ['bat_dau', 'het_han', 'loai_bh', 'ghi_chu']) {
      if (k in body) updates[k] = body[k] ?? null
    }

    const { data, error } = await supabase
      .from('order_warranties').update(updates).eq('id', parseInt(id))
      .select('*, orders!order_id(ma_hd, customers!customer_id(ho_ten))').single()
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('PATCH /api/order-warranties/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/order-warranties/[id] ───────────────────────────────────────

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
    if (!['admin', 'ceo'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Không có quyền xóa' }, { status: 403 })
    }

    const { id } = await params
    const { error } = await supabase
      .from('order_warranties').delete().eq('id', parseInt(id))
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/order-warranties/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
