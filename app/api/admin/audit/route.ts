import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/admin/audit — Nhật ký hoạt động (admin + manager) ──────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['admin', 'manager'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const limit  = Number(req.nextUrl.searchParams.get('limit')  ?? 50)
    const offset = Number(req.nextUrl.searchParams.get('offset') ?? 0)

    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('id, user_name, action, entity, detail, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return NextResponse.json({ data: data ?? [], total: count ?? 0 })
  } catch (err) {
    console.error('GET /api/admin/audit:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
