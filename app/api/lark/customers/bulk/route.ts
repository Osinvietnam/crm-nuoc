import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { PIPELINE_ORDER } from '@/lib/pipeline'

// ─── POST /api/lark/customers/bulk ───────────────────────────────────────────
// Body: { ids: number[], action: 'assign' | 'pipeline' | 'khu_vuc', value: string }
// Chỉ admin/ceo/director mới được dùng bulk actions

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()

    if (!['admin', 'ceo', 'director'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Chỉ admin/ceo/director mới dùng được bulk actions' }, { status: 403 })
    }

    const body = await req.json()
    const { ids, action, value } = body as {
      ids:    number[]
      action: 'assign' | 'pipeline' | 'khu_vuc'
      value:  string
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Danh sách ID rỗng' }, { status: 400 })
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: 'Tối đa 200 KH mỗi lần' }, { status: 400 })
    }
    if (!action || !value) {
      return NextResponse.json({ error: 'Thiếu action hoặc value' }, { status: 400 })
    }

    let updates: Record<string, unknown> = {}
    if (action === 'assign')   updates = { nguoi_phu_trach: value }
    if (action === 'pipeline') {
      if (!(PIPELINE_ORDER as readonly string[]).includes(value)) {
        return NextResponse.json({ error: `Pipeline stage "${value}" không hợp lệ` }, { status: 400 })
      }
      updates = { pipeline: value }
    }
    if (action === 'khu_vuc')  updates = { khu_vuc: value }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .in('id', ids)
      .select('id')

    if (error) throw error

    const updated = data?.length ?? 0

    void logAudit(supabase, {
      user_id:   profile!.id,
      user_name: profile!.full_name,
      action:    'bulk_update',
      entity:    'customer',
      detail:    `Bulk ${action}="${value}" cho ${updated} KH: [${ids.slice(0, 10).join(',')}${ids.length > 10 ? '...' : ''}]`,
      after:     updates,
    })

    return NextResponse.json({ updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/lark/customers/bulk:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
