import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { Product } from '../_mapper'

const ALLOWED_ROLES = ['admin', 'ceo', 'director']

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!ALLOWED_ROLES.includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { rows } = await req.json() as { rows: Partial<Product>[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu' }, { status: 400 })
    }

    // Build ma_sp → Supabase id map
    const { data: existing } = await supabase.from('products').select('id, ma_sp')
    const idByMaSP = new Map<string, number>()
    for (const p of existing ?? []) {
      if (p.ma_sp) idByMaSP.set(String(p.ma_sp).trim(), p.id)
    }

    type ProductFields = Record<string, unknown>

    // Upsert all rows: onConflict ma_sp → update if exists, insert if not
    // But ten_sp is required for new products — filter rows without ten_sp that have no ma_sp match
    const upsertRows = rows
      .filter(row => row.ten_sp || (row.ma_sp && idByMaSP.has(String(row.ma_sp).trim())))
      .map(row => {
        const fields: ProductFields = {}
        if (row.ten_sp         !== undefined) fields.ten_sp         = row.ten_sp
        if (row.ma_sp          !== undefined) fields.ma_sp          = row.ma_sp
        if (row.phan_loai      !== undefined) fields.phan_loai      = row.phan_loai
        if (row.nhom_sp        !== undefined) fields.nhom_sp        = row.nhom_sp
        if (row.gia_niem_yet   !== undefined) fields.gia_niem_yet   = row.gia_niem_yet
        if (row.gia_chiet_khau !== undefined) fields.gia_chiet_khau = row.gia_chiet_khau
        if (row.gia_dai_ly     !== undefined) fields.gia_dai_ly     = row.gia_dai_ly
        if (row.gia_npp        !== undefined) fields.gia_npp        = row.gia_npp
        if (row.hh_kd          !== undefined) fields.hh_kd          = row.hh_kd
        if (row.mo_ta          !== undefined) fields.mo_ta          = row.mo_ta
        return fields
      })

    if (upsertRows.length === 0) return NextResponse.json({ created: 0, updated: 0, total: 0 })

    const { data: upserted, error: upsertErr } = await supabase
      .from('products')
      .upsert(upsertRows, { onConflict: 'ma_sp', ignoreDuplicates: false })
      .select('id, ma_sp')
    if (upsertErr) throw upsertErr

    // Count created vs updated based on whether ma_sp was in idByMaSP before
    const created = upserted?.filter(r => !idByMaSP.has(String(r.ma_sp ?? '').trim())).length ?? 0
    const updated = (upserted?.length ?? 0) - created

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: profile?.role ?? '',
      action:    'product_imported',
      entity:    'product',
      detail:    `Import ${upserted?.length ?? 0} sản phẩm: ${created} mới, ${updated} cập nhật`,
    })

    return NextResponse.json({ created, updated, total: created + updated })
  } catch (err) {
    console.error('POST /api/lark/products/import:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
