import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['admin', 'ceo', 'director']

// ─── GET /api/lark/products/[id]/related ─────────────────────────────────────

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
      .from('product_relations')
      .select(`
        id,
        related_id,
        loai,
        ghi_chu,
        products!product_relations_related_id_fkey(ten_sp, ma_sp, gia_niem_yet, con_hang)
      `)
      .eq('product_id', id)
    if (error) throw error

    const rows = (data ?? []).map((r: any) => ({
      id: r.id,
      related_id: r.related_id,
      loai: r.loai,
      ghi_chu: r.ghi_chu,
      ten_sp: r.products?.ten_sp ?? null,
      ma_sp: r.products?.ma_sp ?? null,
      gia_niem_yet: r.products?.gia_niem_yet ?? 0,
      con_hang: r.products?.con_hang ?? false,
    }))

    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET /api/lark/products/[id]/related:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/lark/products/[id]/related ────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!ADMIN_ROLES.includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { related_id, loai, ghi_chu } = body

    if (!related_id) return NextResponse.json({ error: 'related_id là bắt buộc' }, { status: 400 })
    if (!loai) return NextResponse.json({ error: 'loai là bắt buộc' }, { status: 400 })
    if (String(related_id) === id) {
      return NextResponse.json({ error: 'Không thể liên kết sản phẩm với chính nó' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('product_relations')
      .insert({ product_id: id, related_id, loai, ghi_chu: ghi_chu ?? null })
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/lark/products/[id]/related:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/lark/products/[id]/related?related_id=xxx ───────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!ADMIN_ROLES.includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = req.nextUrl
    const related_id = searchParams.get('related_id')
    if (!related_id) {
      return NextResponse.json({ error: 'related_id là bắt buộc' }, { status: 400 })
    }

    const { error } = await supabase
      .from('product_relations')
      .delete()
      .eq('product_id', id)
      .eq('related_id', related_id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/lark/products/[id]/related:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
