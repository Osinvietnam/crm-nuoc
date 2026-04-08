import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listAllRecords, batchCreateRecords, batchUpdateRecords } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'
import { mapProduct, productToFields } from '../_mapper'
import type { Product } from '../_mapper'

// Chunk array into slices of max `size`
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // rows: array of partial Product from client-parsed Excel
    const { rows } = await req.json() as { rows: Partial<Product>[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu' }, { status: 400 })
    }

    // Fetch existing products to build Mã SP → record_id map
    const existing = await listAllRecords(TABLES.PRODUCTS)
    const idByMaSP = new Map<string, string>()
    for (const r of existing) {
      const maSP = String(r.fields['Mã SP'] ?? '').trim()
      if (maSP) idByMaSP.set(maSP, r.record_id)
    }

    const toCreate: Record<string, unknown>[] = []
    const toUpdate: { record_id: string; fields: Record<string, unknown> }[] = []

    for (const row of rows) {
      const fields = productToFields(row)
      const maSP = String(row.ma_sp ?? '').trim()
      const existingId = maSP ? idByMaSP.get(maSP) : undefined

      if (existingId) {
        toUpdate.push({ record_id: existingId, fields })
      } else {
        toCreate.push(fields)
      }
    }

    let created = 0
    let updated = 0

    // Lark batch APIs max 500 per call
    for (const batch of chunk(toCreate, 500)) {
      const records = await batchCreateRecords(TABLES.PRODUCTS, batch)
      created += records.length
    }
    for (const batch of chunk(toUpdate, 500)) {
      const records = await batchUpdateRecords(TABLES.PRODUCTS, batch)
      updated += records.length
    }

    return NextResponse.json({ created, updated, total: created + updated })
  } catch (err) {
    console.error('POST /api/lark/products/import:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
