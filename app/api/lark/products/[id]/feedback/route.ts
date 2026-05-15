import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/lark/products/[id]/feedback ─────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { data, error } = await supabase
      .from('product_feedback')
      .select('id, rating, noi_dung, nguon, ref_id, created_at, from_user, profiles(full_name)')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
    if (error) throw error

    const feedbacks = (data ?? []).map((f: any) => ({
      id: f.id,
      rating: f.rating,
      noi_dung: f.noi_dung,
      nguon: f.nguon,
      ref_id: f.ref_id,
      created_at: f.created_at,
      from_user: f.from_user,
      user_name: f.profiles?.full_name ?? null,
    }))

    const count = feedbacks.length
    const avg_rating =
      count > 0
        ? Math.round((feedbacks.reduce((s, f) => s + (f.rating ?? 0), 0) / count) * 10) / 10
        : null

    return NextResponse.json({ avg_rating, count, data: feedbacks })
  } catch (err) {
    console.error('GET /api/lark/products/[id]/feedback:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/lark/products/[id]/feedback ────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { rating, noi_dung, nguon, ref_id } = body

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating phải từ 1 đến 5' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('product_feedback')
      .upsert(
        {
          product_id: id,
          from_user: user.id,
          rating,
          noi_dung: noi_dung ?? null,
          nguon: nguon ?? null,
          ref_id: ref_id ?? null,
        },
        { onConflict: 'product_id,from_user' },
      )
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('POST /api/lark/products/[id]/feedback:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
