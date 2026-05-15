import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/lark/products/[id]/qr ──────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm.example.com'
    const productUrl = `${appUrl}/dashboard/products/${id}`

    // Try qrcode package; fall back to QR server API
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const QRCode = require('qrcode') as typeof import('qrcode')
      const dataUrl: string = await QRCode.toDataURL(productUrl, { width: 300, margin: 2 })
      return NextResponse.json({ data_url: dataUrl, url: productUrl })
    } catch {
      // qrcode not available — fall back to QR server
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&data=${encodeURIComponent(productUrl)}`
      return NextResponse.json({ qr_url: qrUrl, product_url: productUrl })
    }
  } catch (err) {
    console.error('GET /api/lark/products/[id]/qr:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
