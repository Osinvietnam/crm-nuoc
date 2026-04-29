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
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const sp     = req.nextUrl.searchParams
    const limit  = Number(sp.get('limit')  ?? 50)
    const offset = Number(sp.get('offset') ?? 0)
    const action    = sp.get('action')
    const user_name = sp.get('user_name')
    const entity    = sp.get('entity')
    const from      = sp.get('from')
    const to        = sp.get('to')

    let query = supabase
      .from('audit_logs')
      .select('id, user_name, action, entity, detail, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (action)    query = query.eq('action', action)
    if (user_name) query = query.ilike('user_name', `%${user_name}%`)
    if (entity)    query = query.eq('entity', entity)
    if (from)      query = query.gte('created_at', from)
    if (to)        query = query.lte('created_at', to)

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) throw error
    return NextResponse.json({ data: data ?? [], total: count ?? 0 })
  } catch (err) {
    console.error('GET /api/admin/audit:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
