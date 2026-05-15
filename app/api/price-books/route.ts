import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/price-books ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = req.nextUrl.searchParams
    const activeOnly = searchParams.get('active') === 'true'

    let query = supabase
      .from('price_books')
      .select(`
        id,
        ten,
        mo_ta,
        ap_dung_cho,
        hieu_luc_tu,
        hieu_luc_den,
        is_default,
        created_at,
        price_book_items(count)
      `)
      .order('created_at', { ascending: false })

    if (activeOnly) {
      const today = new Date().toISOString().split('T')[0]
      query = query
        .or(`hieu_luc_tu.is.null,hieu_luc_tu.lte.${today}`)
        .or(`hieu_luc_den.is.null,hieu_luc_den.gte.${today}`)
    }

    const { data, error } = await query
    if (error) throw error

    const result = (data ?? []).map((book: any) => ({
      id: book.id,
      ten: book.ten,
      mo_ta: book.mo_ta,
      ap_dung_cho: book.ap_dung_cho,
      hieu_luc_tu: book.hieu_luc_tu,
      hieu_luc_den: book.hieu_luc_den,
      is_default: book.is_default,
      created_at: book.created_at,
      item_count: book.price_book_items?.[0]?.count ?? 0,
    }))

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('GET /api/price-books:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/price-books ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'ceo', 'director'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    if (!body.ten) {
      return NextResponse.json({ error: 'Tên price book là bắt buộc' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('price_books')
      .insert({
        ten:          body.ten,
        mo_ta:        body.mo_ta        || null,
        ap_dung_cho:  body.ap_dung_cho  ?? [],
        hieu_luc_tu:  body.hieu_luc_tu  || null,
        hieu_luc_den: body.hieu_luc_den || null,
        is_default:   body.is_default   ?? false,
      })
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/price-books:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
