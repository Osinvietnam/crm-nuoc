import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const BUCKET = 'payment-proofs'

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
]

// ─── POST /api/payments/proof — Upload chứng từ thanh toán ───────────────────
// FormData: file (File), payment_id (string)
// → Upload to Storage → UPDATE payment_records.proof_url → 200 { url }

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    if (!['accountant', 'admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Chỉ kế toán/admin/CEO/giám đốc mới upload được' }, { status: 403 })
    }

    const formData  = await req.formData()
    const file      = formData.get('file')       as File | null
    const paymentId = formData.get('payment_id') as string | null

    if (!file)      return NextResponse.json({ error: 'Không có file' }, { status: 400 })
    if (!paymentId) return NextResponse.json({ error: 'Thiếu payment_id' }, { status: 400 })

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File tối đa 10MB' }, { status: 400 })
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: 'Chỉ chấp nhận ảnh (JPG/PNG/WEBP) hoặc PDF' }, { status: 400 })
    }

    // Verify payment exists
    const { data: payment, error: fetchErr } = await supabase
      .from('payment_records')
      .select('id, customer_name')
      .eq('id', Number(paymentId))
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchErr || !payment) {
      return NextResponse.json({ error: 'Không tìm thấy đợt thanh toán' }, { status: 404 })
    }

    // Upload to storage (service role bypasses RLS)
    const svc  = createServiceClient()
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `${paymentId}/${Date.now()}.${ext}`

    const bytes = await file.arrayBuffer()
    const { error: uploadErr } = await svc.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (uploadErr) {
      console.error('[payments/proof] Storage error:', uploadErr)
      return NextResponse.json({ error: 'Upload thất bại: ' + uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = svc.storage.from(BUCKET).getPublicUrl(path)

    // Update payment_records.proof_url
    const { error: updateErr } = await supabase
      .from('payment_records')
      .update({ proof_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', Number(paymentId))

    if (updateErr) throw updateErr

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'payment_proof_uploaded',
      entity:    'payment',
      detail:    `ID ${paymentId} (${payment.customer_name ?? '?'}): ${file.name}`,
    })

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('POST /api/payments/proof:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
