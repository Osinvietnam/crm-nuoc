import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/price-books/[id] ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { data: book, error: bookError } = await supabase
      .from('price_books')
      .select('*')
      .eq('id', id)
      .single()
    if (bookError) throw bookError
    if (!book) return NextResponse.json({ error: 'Không tìm thấy price book' }, { status: 404 })

    const { data: items, error: itemsError } = await supabase
      .from('price_book_items')
      .select(`
        product_id,
        gia_override,
        ghi_chu,
        products (
          id,
          ten_sp,
          ma_sp,
          gia_niem_yet
        )
      `)
      .eq('price_book_id', id)
    if (itemsError) throw itemsError

    const mappedItems = (items ?? []).map((item: any) => ({
      product_id:   item.product_id,
      ten_sp:       item.products?.ten_sp ?? null,
      ma_sp:        item.products?.ma_sp ?? null,
      gia_niem_yet: item.products?.gia_niem_yet ?? null,
      gia_override: item.gia_override,
      ghi_chu:      item.ghi_chu,
    }))

    return NextResponse.json({ data: { ...book, items: mappedItems } })
  } catch (err) {
    console.error('GET /api/price-books/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/price-books/[id] ─────────────────────────────────────────────

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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { items, ...bookFields } = body

    const allowedFields: Record<string, unknown> = {}
    const updatable = ['ten', 'mo_ta', 'ap_dung_cho', 'hieu_luc_tu', 'hieu_luc_den', 'is_default']
    for (const key of updatable) {
      if (key in bookFields) allowedFields[key] = bookFields[key]
    }

    if (Object.keys(allowedFields).length > 0) {
      const { error } = await supabase
        .from('price_books')
        .update(allowedFields)
        .eq('id', id)
      if (error) throw error
    }

    if (Array.isArray(items)) {
      const { error: delError } = await supabase
        .from('price_book_items')
        .delete()
        .eq('price_book_id', id)
      if (delError) throw delError

      if (items.length > 0) {
        const rows = items.map((item: { product_id: number; gia_override?: number; ghi_chu?: string }) => ({
          price_book_id: id,
          product_id:    item.product_id,
          gia_override:  item.gia_override ?? null,
          ghi_chu:       item.ghi_chu      ?? null,
        }))
        const { error: insError } = await supabase
          .from('price_book_items')
          .insert(rows)
        if (insError) throw insError
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/price-books/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/price-books/[id] ────────────────────────────────────────────

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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const { error } = await supabase
      .from('price_books')
      .delete()
      .eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/price-books/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
