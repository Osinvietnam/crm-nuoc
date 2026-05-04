import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const toInsert: ProductFields[] = []
    const toUpdate: { id: number; fields: ProductFields }[] = []

    for (const row of rows) {
      const maSP    = String(row.ma_sp ?? '').trim()
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

      const existingId = maSP ? idByMaSP.get(maSP) : undefined
      if (existingId) {
        toUpdate.push({ id: existingId, fields })
      } else {
        if (!row.ten_sp) continue  // ten_sp required for new product
        toInsert.push(fields)
      }
    }

    let created = 0
    let updated = 0

    if (toInsert.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from('products').insert(toInsert).select('id')
      if (insertErr) throw insertErr
      created = inserted?.length ?? 0
    }

    if (toUpdate.length > 0) {
      const results = await Promise.all(
        toUpdate.map(({ id, fields }) =>
          supabase.from('products').update(fields).eq('id', id)
        )
      )
      updated = results.filter(r => !r.error).length
    }

    return NextResponse.json({ created, updated, total: created + updated })
  } catch (err) {
    console.error('POST /api/lark/products/import:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
