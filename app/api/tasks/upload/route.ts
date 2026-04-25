import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'task-attachments'

// ─── POST /api/tasks/upload — Upload file đính kèm cho task ──────────────────
// FormData: file (File), task_key (string), customer_id (string)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData  = await req.formData()
    const file      = formData.get('file')      as File | null
    const taskKey   = formData.get('task_key')  as string | null
    const customerId= formData.get('customer_id') as string | null

    if (!file)       return NextResponse.json({ error: 'Không có file' }, { status: 400 })
    if (!taskKey)    return NextResponse.json({ error: 'Thiếu task_key' }, { status: 400 })
    if (!customerId) return NextResponse.json({ error: 'Thiếu customer_id' }, { status: 400 })

    // Validate file size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File tối đa 10MB' }, { status: 400 })
    }

    // Validate file type
    const ALLOWED = [
      'image/jpeg', 'image/png', 'image/webp', 'image/heic',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Chỉ chấp nhận ảnh, PDF, DOCX, XLSX' }, { status: 400 })
    }

    const ext      = file.name.split('.').pop() ?? 'bin'
    const path     = `${customerId}/${taskKey}_${Date.now()}.${ext}`

    const bytes = await file.arrayBuffer()
    const svc   = createServiceClient()

    const { error: uploadErr } = await svc.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false })

    if (uploadErr) {
      console.error('[tasks/upload] Storage error:', uploadErr)
      return NextResponse.json({ error: 'Upload thất bại: ' + uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = svc.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('POST /api/tasks/upload:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
