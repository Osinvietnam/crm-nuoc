import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET   = 'task-attachments'
const MAX_MB   = 10
const ALLOWED  = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// ─── POST /api/lark/maintenance/construction/[id]/photos ─────────────────────
// Upload ảnh nghiệm thu → lưu Supabase Storage, append URL vào hinh_anh[]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const ALLOWED_ROLES = ['admin', 'ceo', 'director', 'tech', 'logistics']
    if (!ALLOWED_ROLES.includes(me?.role ?? '')) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const { id } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Thiếu file' }, { status: 400 })
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File quá lớn (tối đa ${MAX_MB}MB)` }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Chỉ chấp nhận ảnh JPG/PNG/WebP/HEIC' }, { status: 400 })
    }

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `maintenance/${id}/${Date.now()}.${ext}`
    const service = createServiceClient()

    const { error: upErr } = await service.storage.from(BUCKET).upload(path, file, { contentType: file.type })
    if (upErr) throw upErr

    const { data: { publicUrl } } = service.storage.from(BUCKET).getPublicUrl(path)

    // Append URL vào hinh_anh[]
    const { error: dbErr } = await service.rpc('append_maintenance_photo', {
      p_id: Number(id),
      p_url: publicUrl,
    })
    if (dbErr) {
      // Fallback: fetch current array then update
      const { data: cur } = await service
        .from('maintenance_construction').select('hinh_anh').eq('id', Number(id)).single()
      const arr = (cur?.hinh_anh as string[] | null) ?? []
      await service
        .from('maintenance_construction')
        .update({ hinh_anh: [...arr, publicUrl] })
        .eq('id', Number(id))
    }

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err) {
    console.error('POST /api/lark/maintenance/construction/[id]/photos:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/lark/maintenance/construction/[id]/photos?url= ──────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'ceo', 'director', 'tech'].includes(me?.role ?? '')) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const { id } = await params
    const url = req.nextUrl.searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'Thiếu url' }, { status: 400 })

    const service = createServiceClient()
    const { data: cur } = await service
      .from('maintenance_construction').select('hinh_anh').eq('id', Number(id)).single()
    const arr = ((cur?.hinh_anh as string[] | null) ?? []).filter(u => u !== url)
    await service.from('maintenance_construction').update({ hinh_anh: arr }).eq('id', Number(id))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/lark/maintenance/construction/[id]/photos:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
