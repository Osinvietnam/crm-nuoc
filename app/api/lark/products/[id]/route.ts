import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapProduct } from '../_mapper'
import { logAudit } from '@/lib/audit'

// ─── GET /api/lark/products/[id] ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const query = supabase.from('products').select('*')
    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    return NextResponse.json({ data: mapProduct(data) })
  } catch (err) {
    console.error('GET /api/lark/products/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/lark/products/[id] ───────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!['admin', 'ceo', 'director'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const allowed = ['ten_sp', 'ma_sp', 'phan_loai', 'nhom_sp', 'gia_niem_yet',
      'gia_chiet_khau', 'gia_dai_ly', 'gia_npp', 'hh_kd', 'mo_ta', 'con_hang']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    // Fetch current values for before/after audit
    const numId = /^\d+$/.test(id) ? parseInt(id) : null
    const { data: current } = await supabase.from('products').select('*')
      .eq(numId !== null ? 'id' : 'lark_record_id', numId ?? id).single()

    const query = supabase.from('products').update(updates).select('*')
    const { data, error } = await (numId !== null
      ? query.eq('id', numId)
      : query.eq('lark_record_id', id)
    ).single()

    if (error) throw error

    const beforeSnap = current
      ? Object.fromEntries(Object.keys(updates).map(k => [k, (current as Record<string, unknown>)[k]]))
      : undefined
    void logAudit(supabase, {
      user_id:   user.id,
      user_name: profile?.full_name ?? '',
      action:    'product_updated',
      entity:    'product',
      detail:    `SP #${id}: ${Object.keys(updates).join(', ')}`,
      before:    beforeSnap,
      after:     updates,
    })
    return NextResponse.json({ data: mapProduct(data) })
  } catch (err) {
    console.error('PATCH /api/lark/products/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/lark/products/[id] — Xóa sản phẩm (admin/ceo/director) ──────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!['admin', 'ceo', 'director'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Chỉ admin/CEO/Director mới xóa được sản phẩm' }, { status: 403 })
    }

    const { id } = await params
    const query = supabase.from('products').delete()
    const { error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    )

    if (error) throw error
    void logAudit(supabase, { user_id: user.id, user_name: profile?.full_name ?? '', action: 'product_deleted', entity: 'product', detail: `SP #${id}` })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/lark/products/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
