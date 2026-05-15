import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['admin', 'ceo', 'director']
const BUCKET = 'product-docs'
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

// ─── GET /api/lark/products/[id]/documents ────────────────────────────────────

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
      .from('product_documents')
      .select('id, loai, ten_file, file_url, file_size, created_at, uploaded_by, profiles(full_name)')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
    if (error) throw error

    const docs = (data ?? []).map((d: any) => ({
      id: d.id,
      loai: d.loai,
      ten_file: d.ten_file,
      file_url: d.file_url,
      file_size: d.file_size,
      created_at: d.created_at,
      uploaded_by: d.uploaded_by,
      uploaded_by_name: d.profiles?.full_name ?? null,
    }))

    return NextResponse.json({ data: docs })
  } catch (err) {
    console.error('GET /api/lark/products/[id]/documents:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/lark/products/[id]/documents ───────────────────────────────────

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

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const loai = formData.get('loai') as string | null
    const ten_file_input = formData.get('ten_file') as string | null

    if (!file) return NextResponse.json({ error: 'File là bắt buộc' }, { status: 400 })
    if (!loai) return NextResponse.json({ error: 'loai là bắt buộc' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File không được vượt quá 20MB' }, { status: 400 })
    }

    const ten_file = ten_file_input || file.name
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${id}/${Date.now()}_${safeName}`

    const bytes = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type })
    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const { data: doc, error: insertErr } = await supabase
      .from('product_documents')
      .insert({
        product_id: id,
        loai,
        ten_file,
        file_url: publicUrl,
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select('id, loai, ten_file, file_url, file_size, created_at')
      .single()
    if (insertErr) throw insertErr

    return NextResponse.json({ data: doc }, { status: 201 })
  } catch (err) {
    console.error('POST /api/lark/products/[id]/documents:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
