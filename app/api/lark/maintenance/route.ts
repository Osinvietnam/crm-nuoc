import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cachedListAllRecords } from '@/lib/lark/cached'
import { TABLES } from '@/lib/lark/tables'
import { mappers } from './_mappers'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const tab = req.nextUrl.searchParams.get('tab') ?? 'construction'
    const isTechRestricted = profile.role === 'tech'
    const isPartnerRestricted = profile.role === 'partner'

    if (tab === 'construction') {
      // TB07 - KTV phụ trách là plain text
      const filter = isTechRestricted
        ? `CurrentValue.[KTV phụ trách] = "${profile.full_name}"`
        : undefined
      const records = await cachedListAllRecords(TABLES.CONSTRUCTION, filter)
      return NextResponse.json({ data: records.map(mappers.construction) })
    }

    if (tab === 'periodic') {
      // TB11 - NV phụ trách là linked record
      const filter = (isTechRestricted || isPartnerRestricted)
        ? `CurrentValue.[NV phụ trách].[text] = "${profile.full_name}"`
        : undefined
      const records = await cachedListAllRecords(TABLES.PERIODIC_SERVICE, filter)
      return NextResponse.json({ data: records.map(mappers.periodic) })
    }

    return NextResponse.json({ error: 'Tab không hợp lệ' }, { status: 400 })
  } catch (err) {
    console.error('GET /api/lark/maintenance:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
