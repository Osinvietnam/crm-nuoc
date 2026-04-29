import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const ASSET_TYPES = ['may_moc', 'xe_cong', 'thiet_bi_van_phong', 'khac'] as const

function calcDepreciation(asset: {
  gia_tri_ban_dau: number
  ngay_mua: string
  thoi_gian_kh_thang: number
  is_active: boolean
}) {
  const khau_hao_thang = Math.round(asset.gia_tri_ban_dau / asset.thoi_gian_kh_thang)
  const purchaseDate   = new Date(asset.ngay_mua)
  const now            = new Date()
  const so_thang_da_qua = Math.max(0,
    (now.getFullYear() - purchaseDate.getFullYear()) * 12 +
    (now.getMonth() - purchaseDate.getMonth())
  )
  const is_fully_depreciated = so_thang_da_qua >= asset.thoi_gian_kh_thang
  const gia_tri_con_lai = Math.max(0, asset.gia_tri_ban_dau - so_thang_da_qua * khau_hao_thang)
  const so_thang_con_lai = Math.max(0, asset.thoi_gian_kh_thang - so_thang_da_qua)
  return { khau_hao_thang, so_thang_da_qua, gia_tri_con_lai, so_thang_con_lai, is_fully_depreciated }
}

// ─── GET /api/finance/assets?active=true ─────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'accountant'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const activeOnly = req.nextUrl.searchParams.get('active') !== 'false'

    const service = createServiceClient()
    let query = service.from('assets').select('*').order('ngay_mua', { ascending: false })
    if (activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error

    // Tính khấu hao cho từng tài sản
    const enriched = (data ?? []).map(asset => ({
      ...asset,
      ...calcDepreciation(asset),
    }))

    const tong_khau_hao_thang = enriched
      .filter(a => a.is_active && !a.is_fully_depreciated)
      .reduce((sum, a) => sum + a.khau_hao_thang, 0)

    return NextResponse.json({ data: enriched, tong_khau_hao_thang })
  } catch (err) {
    console.error('GET /api/finance/assets:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/finance/assets — Thêm tài sản ─────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !['admin', 'ceo'].includes(me.role)) {
      return NextResponse.json({ error: 'Chỉ admin/CEO mới thêm tài sản' }, { status: 403 })
    }

    const body = await req.json()
    const { ten_tai_san, loai_tai_san, gia_tri_ban_dau, ngay_mua, thoi_gian_kh_thang, ghi_chu } = body

    if (!ten_tai_san || !loai_tai_san || !gia_tri_ban_dau || !ngay_mua) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 })
    }
    if (!ASSET_TYPES.includes(loai_tai_san)) {
      return NextResponse.json({ error: 'loai_tai_san không hợp lệ' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data, error } = await service.from('assets').insert({
      ten_tai_san,
      loai_tai_san,
      gia_tri_ban_dau: Number(gia_tri_ban_dau),
      ngay_mua,
      thoi_gian_kh_thang: Number(thoi_gian_kh_thang ?? 36),
      ghi_chu:    ghi_chu ?? null,
      created_by: user.id,
    }).select().single()

    if (error) throw error
    void logAudit(supabase, { user_id: user.id, user_name: me.full_name ?? '', action: 'asset_created', entity: 'asset', detail: `"${ten_tai_san}" — ${loai_tai_san}` })
    return NextResponse.json({ data: { ...data, ...calcDepreciation(data) } }, { status: 201 })
  } catch (err) {
    console.error('POST /api/finance/assets:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/finance/assets — Sửa / thanh lý tài sản ─────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !['admin', 'ceo'].includes(me.role)) {
      return NextResponse.json({ error: 'Chỉ admin/CEO mới sửa tài sản' }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    const allowed = ['ten_tai_san', 'loai_tai_san', 'gia_tri_ban_dau', 'ngay_mua', 'thoi_gian_kh_thang', 'is_active', 'ghi_chu']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in rest) updates[key] = rest[key]
    }

    const service = createServiceClient()
    const { data, error } = await service.from('assets').update(updates).eq('id', id).select().single()
    if (error) throw error
    void logAudit(supabase, { user_id: user.id, user_name: me.full_name ?? '', action: 'asset_updated', entity: 'asset', detail: `Tài sản #${id}: ${Object.keys(updates).filter(k => k !== 'updated_at').join(', ')}` })
    return NextResponse.json({ data: { ...data, ...calcDepreciation(data) } })
  } catch (err) {
    console.error('PATCH /api/finance/assets:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
