import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const ALLOWED_KEYS = ['n8n_webhook_url', 'app_url'] as const
type ConfigKey = typeof ALLOWED_KEYS[number]

// ─── GET /api/admin/system — Lấy system config + test kết nối ────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('system_config')
      .select('key, value')

    if (error) throw error

    // Chuyển thành object { key: value }
    const config: Record<string, string> = {}
    for (const row of (data ?? [])) config[row.key] = row.value

    // Thêm trạng thái kết nối LarkBase từ env (không lộ secrets)
    const larkConfigured = !!(process.env.LARK_APP_ID && process.env.LARK_APP_SECRET && process.env.LARK_BASE_APP_TOKEN)

    return NextResponse.json({ data: config, lark_configured: larkConfigured })
  } catch (err) {
    console.error('GET /api/admin/system:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/system — Cập nhật system config (admin) ────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const body: Partial<Record<ConfigKey, string>> = await req.json()
    const updates: { key: string; value: string; updated_at: string }[] = []

    for (const key of ALLOWED_KEYS) {
      if (body[key] !== undefined) {
        updates.push({ key, value: body[key]!, updated_at: new Date().toISOString() })
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu hợp lệ' }, { status: 400 })
    }

    const { error } = await supabase
      .from('system_config')
      .upsert(updates, { onConflict: 'key' })

    if (error) throw error

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'settings_updated',
      entity:    'system_config',
      detail:    `Cập nhật: ${updates.map(u => u.key).join(', ')}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/admin/system:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/admin/system?action=test_lark|test_n8n — Kiểm tra kết nối ─────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const action = req.nextUrl.searchParams.get('action')

    // ── Test LarkBase ─────────────────────────────────────────────────────────
    if (action === 'test_lark') {
      const appId     = process.env.LARK_APP_ID
      const appSecret = process.env.LARK_APP_SECRET
      const appToken  = process.env.LARK_BASE_APP_TOKEN

      if (!appId || !appSecret || !appToken) {
        return NextResponse.json({ ok: false, message: 'LARK_APP_ID / LARK_APP_SECRET / LARK_BASE_APP_TOKEN chưa cấu hình trong env' })
      }

      try {
        const tokenRes = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
          signal: AbortSignal.timeout(8000),
        })
        const tokenData = await tokenRes.json()
        if (tokenData.code !== 0) {
          return NextResponse.json({ ok: false, message: `Lark auth thất bại: ${tokenData.msg}` })
        }
        return NextResponse.json({ ok: true, message: 'Kết nối LarkBase thành công ✓' })
      } catch (e) {
        return NextResponse.json({ ok: false, message: 'Không thể kết nối đến Lark API' })
      }
    }

    // ── Test N8n ──────────────────────────────────────────────────────────────
    if (action === 'test_n8n') {
      const { data: cfg } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'n8n_webhook_url')
        .single()

      const n8nUrl = cfg?.value || process.env.N8N_WEBHOOK_URL
      if (!n8nUrl) {
        return NextResponse.json({ ok: false, message: 'Chưa cấu hình N8n webhook URL' })
      }

      try {
        const res = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _test: true }),
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok || res.status === 404) {
          // 404 vẫn OK — webhook nhận được request
          return NextResponse.json({ ok: true, message: `N8n phản hồi (HTTP ${res.status}) ✓` })
        }
        return NextResponse.json({ ok: false, message: `N8n trả về HTTP ${res.status}` })
      } catch {
        return NextResponse.json({ ok: false, message: 'Không thể kết nối đến N8n webhook' })
      }
    }

    return NextResponse.json({ error: 'action không hợp lệ' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/admin/system:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
