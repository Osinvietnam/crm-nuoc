export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'company-logo'
const KEY    = 'logo'   // file key cố định, luôn overwrite

// ─── POST /api/admin/settings/logo — Upload logo ─────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ admin mới có thể đổi logo' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 })

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Chỉ chấp nhận JPG, PNG, WebP, SVG' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Logo tối đa 2MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(KEY, bytes, { contentType: file.type, upsert: true })

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(KEY)

    // Lưu URL vào company_settings
    await supabase
      .from('company_settings')
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', 1)

    return NextResponse.json({ url: `${publicUrl}?t=${Date.now()}` })
  } catch (err) {
    console.error('POST /api/admin/settings/logo:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/admin/settings/logo — Xoá logo ──────────────────────────────

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ admin mới có thể xoá logo' }, { status: 403 })
    }

    await supabase.storage.from(BUCKET).remove([KEY])
    await supabase
      .from('company_settings')
      .update({ logo_url: '', updated_at: new Date().toISOString() })
      .eq('id', 1)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/settings/logo:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
