import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

export interface CompanySettings {
  name:     string
  address:  string
  phone:    string
  email:    string
  tax:      string
  website:  string
  logo_url: string
}

// ─── GET /api/admin/settings ──────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('company_settings')
      .select('name, address, phone, email, tax, website, logo_url')
      .eq('id', 1)
      .single()

    if (error) throw error
    return NextResponse.json({ data: data ?? {} })
  } catch (err) {
    console.error('GET /api/admin/settings:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/settings ────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Chỉ admin
    const { data: me } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ admin mới có thể chỉnh thông tin công ty' }, { status: 403 })
    }

    const body: Partial<CompanySettings> = await req.json()
    const allowed: (keyof CompanySettings)[] = ['name', 'address', 'phone', 'email', 'tax', 'website', 'logo_url']
    const fields: Partial<CompanySettings> = {}
    for (const k of allowed) {
      if (body[k] !== undefined) fields[k] = body[k]
    }

    const { error } = await supabase
      .from('company_settings')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', 1)

    if (error) throw error

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'settings_updated',
      entity:    'company_settings',
      detail:    `Cập nhật thông tin công ty: ${Object.keys(fields).join(', ')}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/admin/settings:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
