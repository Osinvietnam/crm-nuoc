import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createRecord } from '@/lib/lark/client'
import { cachedListAllRecords } from '@/lib/lark/cached'
import { TABLES } from '@/lib/lark/tables'
import { mapProduct, productToFields } from './_mapper'

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const records = await cachedListAllRecords(TABLES.PRODUCTS)
    return NextResponse.json({ data: records.map(mapProduct) })
  } catch (err) {
    console.error('GET /api/lark/products:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
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

    const body = await req.json()
    if (!body.ten_sp) {
      return NextResponse.json({ error: 'Tên sản phẩm là bắt buộc' }, { status: 400 })
    }

    const record = await createRecord(TABLES.PRODUCTS, productToFields(body))
    revalidateTag('lark-products', 'max')
    return NextResponse.json({ data: mapProduct(record) }, { status: 201 })
  } catch (err) {
    console.error('POST /api/lark/products:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
