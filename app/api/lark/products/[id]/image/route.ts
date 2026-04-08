import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateRecord } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'

const BUCKET = 'product-images'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Chỉ chấp nhận ảnh JPG, PNG, WebP, GIF' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ảnh tối đa 5MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(id, bytes, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(id)

    // Ghi URL ngược về LarkBase (không có cache-bust để URL cố định)
    await updateRecord(TABLES.PRODUCTS, id, { 'Ảnh sản phẩm': publicUrl })
      .catch(e => console.error('Sync anh_sp to Lark failed:', e))

    // Trả về URL có cache-bust cho UI
    const url = `${publicUrl}?t=${Date.now()}`
    return NextResponse.json({ url })
  } catch (err) {
    console.error('POST /api/lark/products/[id]/image:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

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
    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    await supabase.storage.from(BUCKET).remove([id])
    await updateRecord(TABLES.PRODUCTS, id, { 'Ảnh sản phẩm': '' })
      .catch(e => console.error('Clear anh_sp in Lark failed:', e))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/lark/products/[id]/image:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
