import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['admin', 'ceo', 'director']
const BUCKET = 'product-docs'

// ─── DELETE /api/lark/products/[id]/documents/[docId] ─────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
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

    const { id, docId } = await params

    // Lấy document để biết đường dẫn file
    const { data: doc, error: fetchErr } = await supabase
      .from('product_documents')
      .select('id, file_url')
      .eq('id', docId)
      .eq('product_id', id)
      .single()
    if (fetchErr || !doc) {
      return NextResponse.json({ error: 'Document không tồn tại' }, { status: 404 })
    }

    // Extract storage path từ publicUrl
    // URL format: .../storage/v1/object/public/product-docs/{path}
    try {
      const url = new URL(doc.file_url)
      const marker = `/object/public/${BUCKET}/`
      const idx = url.pathname.indexOf(marker)
      if (idx !== -1) {
        const storagePath = decodeURIComponent(url.pathname.slice(idx + marker.length))
        const { error: storageErr } = await supabase.storage.from(BUCKET).remove([storagePath])
        if (storageErr) {
          console.error('Storage delete failed (continuing):', storageErr)
        }
      }
    } catch (parseErr) {
      console.error('Could not parse file_url for storage delete (continuing):', parseErr)
    }

    // Xóa DB record
    const { error: deleteErr } = await supabase
      .from('product_documents')
      .delete()
      .eq('id', docId)
      .eq('product_id', id)
    if (deleteErr) throw deleteErr

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/lark/products/[id]/documents/[docId]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
