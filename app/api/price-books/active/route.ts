import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/price-books/active ─────────────────────────────────────────────
// Query params: ?role=sales&loai_kh=dai_ly

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = req.nextUrl.searchParams
    const role    = searchParams.get('role')    ?? ''
    const loai_kh = searchParams.get('loai_kh') ?? ''
    const today   = new Date().toISOString().split('T')[0]

    // Lấy tất cả price books đang trong hiệu lực
    const { data: books, error } = await supabase
      .from('price_books')
      .select(`
        *,
        price_book_items (
          product_id,
          gia_override,
          ghi_chu,
          products (
            id,
            ten_sp,
            ma_sp,
            gia_niem_yet
          )
        )
      `)
      .or(`hieu_luc_tu.is.null,hieu_luc_tu.lte.${today}`)
      .or(`hieu_luc_den.is.null,hieu_luc_den.gte.${today}`)
    if (error) throw error

    // Tìm price book phù hợp với role hoặc loai_kh
    let matched = (books ?? []).find((book: any) => {
      const targets: string[] = book.ap_dung_cho ?? []
      return (role && targets.includes(role)) || (loai_kh && targets.includes(loai_kh))
    })

    // Fallback: lấy price book is_default
    if (!matched) {
      const { data: defaultBook, error: defError } = await supabase
        .from('price_books')
        .select(`
          *,
          price_book_items (
            product_id,
            gia_override,
            ghi_chu,
            products (
              id,
              ten_sp,
              ma_sp,
              gia_niem_yet
            )
          )
        `)
        .eq('is_default', true)
        .single()
      if (defError && defError.code !== 'PGRST116') throw defError
      matched = defaultBook ?? null
    }

    if (!matched) return NextResponse.json({ data: null })

    const mappedItems = (matched.price_book_items ?? []).map((item: any) => ({
      product_id:   item.product_id,
      ten_sp:       item.products?.ten_sp ?? null,
      ma_sp:        item.products?.ma_sp ?? null,
      gia_niem_yet: item.products?.gia_niem_yet ?? null,
      gia_override: item.gia_override,
      ghi_chu:      item.ghi_chu,
    }))

    const { price_book_items: _, ...bookData } = matched
    return NextResponse.json({ data: { ...bookData, items: mappedItems } })
  } catch (err) {
    console.error('GET /api/price-books/active:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
