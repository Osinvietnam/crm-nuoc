import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── GET /api/admin/pipeline-config ──────────────────────────────────────────
// Trả về cấu hình pipeline cho tất cả order_types

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Tất cả authenticated đều đọc được (UI cần biết stages của từng order_type)
    const { data, error } = await supabase
      .from('pipeline_configs')
      .select('*')
      .order('order_type')

    if (error) throw error

    return NextResponse.json({ configs: data ?? [] })
  } catch (err) {
    console.error('GET /api/admin/pipeline-config:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/pipeline-config?order_type= — Cập nhật stages ──────────
// Body: { stages: string[], stage_labels: string[] }

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ Admin mới được chỉnh pipeline' }, { status: 403 })
    }

    const order_type = req.nextUrl.searchParams.get('order_type')
    if (!order_type) {
      return NextResponse.json({ error: 'Thiếu order_type' }, { status: 400 })
    }

    const body = await req.json()
    const { stages, stage_labels, display_name, description, is_active } = body

    // Validate stages phải có ít nhất 3 stages
    if (stages && stages.length < 3) {
      return NextResponse.json({ error: 'Pipeline cần ít nhất 3 stages' }, { status: 400 })
    }
    if (stages && stage_labels && stages.length !== stage_labels.length) {
      return NextResponse.json({ error: 'stages và stage_labels phải cùng số lượng' }, { status: 400 })
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    if (stages)       patch.stages       = stages
    if (stage_labels) patch.stage_labels = stage_labels
    if (display_name) patch.display_name = display_name
    if (description !== undefined) patch.description = description
    if (is_active   !== undefined) patch.is_active   = is_active

    const svc = createServiceClient()
    const { data, error } = await svc
      .from('pipeline_configs')
      .update(patch)
      .eq('order_type', order_type)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ config: data })
  } catch (err) {
    console.error('PATCH /api/admin/pipeline-config:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
