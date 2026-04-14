import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mappers } from './_mappers'

// ─── SELECT strings ───────────────────────────────────────────────────────────

const CONSTRUCTION_SELECT = `
  *,
  ktv:ktv_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt, dia_chi)
`
const PERIODIC_SELECT = `
  *,
  staff:nv_phu_trach(id, full_name),
  customers!customer_id(id, ho_ten, sdt, dia_chi)
`

// ─── GET /api/lark/maintenance ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const tab       = req.nextUrl.searchParams.get('tab') ?? 'construction'
    const isTech    = profile.role === 'tech'
    const isPartner = profile.role === 'partner'

    if (tab === 'construction') {
      let query = supabase.from('maintenance_construction').select(CONSTRUCTION_SELECT)
        .order('created_at', { ascending: false })
      if (isTech) query = query.eq('ktv_phu_trach', profile.id)
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ data: (data ?? []).map(mappers.construction) })
    }

    if (tab === 'periodic') {
      let query = supabase.from('maintenance_periodic').select(PERIODIC_SELECT)
        .order('lan_bd_tiep_theo', { ascending: true })
      if (isTech || isPartner) query = query.eq('nv_phu_trach', profile.id)
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ data: (data ?? []).map(mappers.periodic) })
    }

    return NextResponse.json({ error: 'Tab không hợp lệ' }, { status: 400 })
  } catch (err) {
    console.error('GET /api/lark/maintenance:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
