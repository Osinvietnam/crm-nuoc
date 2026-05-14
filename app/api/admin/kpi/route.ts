import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// ─── GET /api/admin/kpi?month=&year= ─────────────────────────────────────────
// Trả về toàn bộ KPI targets (kèm tên nhân viên) — chỉ admin/CEO

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

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const year  = searchParams.get('year')

    const service = createServiceClient()
    let query = service.from('kpi_targets').select('*').order('user_id')

    if (month) query = query.eq('month', Number(month))
    if (year)  query = query.eq('year',  Number(year))

    const { data: targets, error } = await query
    if (error) throw error

    // Lấy danh sách profiles để ghép tên
    const { data: profiles } = await service
      .from('profiles')
      .select('id, full_name, role, chuc_vu')

    const profileMap: Record<string, { full_name: string; role: string; chuc_vu?: string }> = {}
    for (const p of profiles ?? []) {
      profileMap[p.id] = { full_name: p.full_name, role: p.role, chuc_vu: p.chuc_vu }
    }

    const enriched = (targets ?? []).map(t => ({
      ...t,
      user_name: profileMap[t.user_id]?.full_name ?? t.user_id,
      user_role: profileMap[t.user_id]?.role ?? '',
      user_chuc_vu: profileMap[t.user_id]?.chuc_vu ?? '',
    }))

    return NextResponse.json({ data: enriched })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('GET /api/admin/kpi:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── POST /api/admin/kpi — Upsert KPI target cho nhân viên ───────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const body = await req.json()
    const { user_id, month, year, target_revenue, target_contracts, target_customers, notes } = body

    if (!user_id || !month || !year) {
      return NextResponse.json({ error: 'Thiếu user_id, month hoặc year' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('kpi_targets')
      .upsert({
        user_id,
        month:            Number(month),
        year:             Number(year),
        target_revenue:   Number(target_revenue ?? 0),
        target_contracts: Number(target_contracts ?? 0),
        target_customers: Number(target_customers ?? 0),
        notes:            notes ?? null,
        created_by:       user.id,
        updated_at:       new Date().toISOString(),
      }, {
        onConflict: 'user_id,month,year',
      })
      .select()
      .single()

    if (error) throw error

    // Lấy tên nhân viên để ghi audit
    const { data: targetUser } = await service
      .from('profiles').select('full_name').eq('id', user_id).single()

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'kpi_target_set',
      entity:    'kpi',
      detail:    `${targetUser?.full_name ?? user_id} — ${month}/${year}: ` +
                 `revenue=${target_revenue}, contracts=${target_contracts}, customers=${target_customers}`,
    })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/admin/kpi:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
