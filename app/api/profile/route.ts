import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const SELF_EDITABLE       = ['phone', 'dia_chi', 'ngay_sinh'] as const
const ADMIN_SELF_EDITABLE = ['cccd', 'ngan_hang', 'so_tk_nh'] as const

// ─── GET /api/profile — Hồ sơ cá nhân của user đang đăng nhập ────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile, error } = await service
      .from('profiles')
      .select('id, full_name, email, role, phone, chuc_vu, khu_vuc, trang_thai_nv, ' +
              'ngay_vao_lam, ngay_sinh, dia_chi, cccd, so_tk_nh, ngan_hang, tinh_trang_hn, ' +
              'target_thang, ma_nv, ma_doi_tac, loai_doi_tac, created_at')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return NextResponse.json({ profile })
  } catch (err) {
    console.error('GET /api/profile:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/profile — NV tự sửa thông tin giới hạn ──────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isPrivileged = ['admin', 'ceo'].includes(me?.role ?? '')

    const updates: Record<string, unknown> = {}
    for (const key of SELF_EDITABLE) {
      if (key in body) updates[key] = body[key] || null
    }
    if (isPrivileged) {
      for (const key of ADMIN_SELF_EDITABLE) {
        if (key in body) updates[key] = body[key] || null
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Không có trường nào được cập nhật' }, { status: 400 })
    }

    const service = createServiceClient()
    const { error } = await service.from('profiles').update(updates).eq('id', user.id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/profile:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
