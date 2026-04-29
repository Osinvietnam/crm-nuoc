import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const BUCKET  = 'task-attachments'
const MAX_MB  = 10
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// ─── POST /api/lark/orders/contract/[id]/delivery ────────────────────────────
// Upload ảnh giao hàng + xác nhận giao hàng thành công
// Body: FormData với `file` (ảnh) và `notes` (text)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    const ALLOWED_ROLES = ['admin', 'ceo', 'director', 'logistics', 'tech']
    if (!ALLOWED_ROLES.includes(me?.role ?? '')) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const { id } = await params
    const formData = await req.formData()
    const file  = formData.get('file')  as File   | null
    const notes = formData.get('notes') as string | null

    const service = createServiceClient()
    const urls: string[] = []

    if (file) {
      if (file.size > MAX_MB * 1024 * 1024) {
        return NextResponse.json({ error: `File quá lớn (tối đa ${MAX_MB}MB)` }, { status: 400 })
      }
      if (!ALLOWED.includes(file.type)) {
        return NextResponse.json({ error: 'Chỉ chấp nhận ảnh JPG/PNG/WebP/HEIC' }, { status: 400 })
      }
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `delivery/${id}/${Date.now()}.${ext}`
      const { error: upErr } = await service.storage.from(BUCKET).upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = service.storage.from(BUCKET).getPublicUrl(path)
      urls.push(publicUrl)
    }

    // Fetch current photos
    const { data: cur } = await service.from('orders').select('delivery_photos').eq('id', Number(id)).single()
    const existing = (cur?.delivery_photos as string[] | null) ?? []

    const updates: Record<string, unknown> = {
      delivery_photos:       [...existing, ...urls],
      delivery_confirmed_at: new Date().toISOString(),
    }
    if (notes) updates.delivery_notes = notes

    await service.from('orders').update(updates).eq('id', Number(id))

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me?.full_name ?? '',
      action:    'order_updated',
      entity:    'order',
      detail:    `HĐ #${id}: xác nhận giao hàng${file ? ' + ảnh' : ''}`,
    })

    return NextResponse.json({ success: true, urls })
  } catch (err) {
    console.error('POST /api/lark/orders/contract/[id]/delivery:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
