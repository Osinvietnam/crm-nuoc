import { NextRequest, NextResponse } from 'next/server'

const roleLabel: Record<string, string> = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  sales: 'Kinh doanh',
  tech: 'Kỹ thuật',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { full_name, email, password, role, department } = body

    const n8nUrl = process.env.N8N_WEBHOOK_URL
    if (!n8nUrl) {
      return NextResponse.json({ error: 'N8N_WEBHOOK_URL chưa cấu hình' }, { status: 500 })
    }

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
        app_url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
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