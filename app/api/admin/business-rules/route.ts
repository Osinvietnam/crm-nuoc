import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// ─── Định nghĩa các business rule keys ───────────────────────────────────────

export interface BusinessRules {
  ceo_approval_threshold: number   // VNĐ — HĐ/BG ≥ ngưỡng này cần CEO duyệt
  sales_max_discount_pct: number   // % — Sale tự quyết chiết khấu tối đa
  default_stage_sla_days: number   // Ngày — SLA mặc định mỗi stage
  stage_sla_override:     Record<string, number>  // e.g. { DN: 14, GH: 14 }
}

const RULE_KEYS = [
  'ceo_approval_threshold',
  'sales_max_discount_pct',
  'default_stage_sla_days',
  'stage_sla_override',
] as const

// ─── GET /api/admin/business-rules ───────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', RULE_KEYS as unknown as string[])

    if (error) throw error

    const raw: Record<string, string> = {}
    for (const row of (data ?? [])) raw[row.key] = row.value

    const rules: BusinessRules = {
      ceo_approval_threshold: Number(raw.ceo_approval_threshold ?? 10000000),
      sales_max_discount_pct: Number(raw.sales_max_discount_pct ?? 1),
      default_stage_sla_days: Number(raw.default_stage_sla_days ?? 3),
      stage_sla_override:     raw.stage_sla_override
        ? JSON.parse(raw.stage_sla_override)
        : { DN: 14, GH: 14, NT: 3 },
    }

    return NextResponse.json({ rules })
  } catch (err) {
    console.error('GET /api/admin/business-rules:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/business-rules — Admin cập nhật ngưỡng ─────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ Admin mới được chỉnh Business Rules' }, { status: 403 })
    }

    const body: Partial<BusinessRules> = await req.json()
    const svc  = createServiceClient()
    const now  = new Date().toISOString()

    const updates: { key: string; value: string }[] = []

    if (body.ceo_approval_threshold !== undefined) {
      if (body.ceo_approval_threshold < 0) {
        return NextResponse.json({ error: 'Ngưỡng không thể âm' }, { status: 400 })
      }
      updates.push({ key: 'ceo_approval_threshold', value: String(body.ceo_approval_threshold) })
    }
    if (body.sales_max_discount_pct !== undefined) {
      if (body.sales_max_discount_pct < 0 || body.sales_max_discount_pct > 100) {
        return NextResponse.json({ error: 'Chiết khấu phải từ 0–100%' }, { status: 400 })
      }
      updates.push({ key: 'sales_max_discount_pct', value: String(body.sales_max_discount_pct) })
    }
    if (body.default_stage_sla_days !== undefined) {
      if (body.default_stage_sla_days < 1) {
        return NextResponse.json({ error: 'SLA tối thiểu 1 ngày' }, { status: 400 })
      }
      updates.push({ key: 'default_stage_sla_days', value: String(body.default_stage_sla_days) })
    }
    if (body.stage_sla_override !== undefined) {
      updates.push({ key: 'stage_sla_override', value: JSON.stringify(body.stage_sla_override) })
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 })
    }

    for (const { key, value } of updates) {
      const { error } = await svc
        .from('system_config')
        .upsert({ key, value }, { onConflict: 'key' })
      if (error) throw error
    }

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? user.email ?? '',
      action:    'settings_updated',
      entity:    'system_config',
      detail:    `Business rules updated: ${updates.map(u => u.key).join(', ')}`,
    })

    return NextResponse.json({ success: true, updated: updates.map(u => u.key) })
  } catch (err) {
    console.error('PATCH /api/admin/business-rules:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
