import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const roleLabel: Record<string, string> = {
  admin:      'Quản trị viên',
  ceo:        'Giám đốc',
  director:   'Quản lý / Phó Giám đốc',
  accountant: 'Kế toán',
  sales:      'Kinh doanh',
  tech:       'Kỹ thuật',
  logistics:  'Hậu cần',
  partner:    'Đối tác',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { full_name, email, password, role, department } = body

    // Đọc N8n URL từ DB trước, fallback về env
    let n8nUrl = process.env.N8N_WEBHOOK_URL ?? ''
    try {
      const supabase = await createClient()
      const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'n8n_webhook_url')
        .single()
      if (data?.value) n8nUrl = data.value
    } catch { /* giữ env fallback */ }

    if (!n8nUrl) {
      return NextResponse.json({ error: 'N8N_WEBHOOK_URL chưa cấu hình' }, { status: 500 })
    }

    const appUrl = (() => {
      try {
        return createClient().then(async (sb) => {
          const { data } = await sb.from('system_config').select('value').eq('key', 'app_url').single()
          return data?.value || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        })
      } catch { return Promise.resolve(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000') }
    })()

    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name,
        email,
        password,
        role,
        role_label: roleLabel[role] ?? role,
        department: department || 'Chưa phân công',
        app_url: await appUrl,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'N8n không phản hồi' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
