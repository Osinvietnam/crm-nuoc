import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { batchCreateRecords } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'

const CHUNK = 50

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
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'ceo', 'director'].includes(profile.role)) {
      return NextResponse.json({ error: 'Chỉ admin/CEO/Director mới được import' }, { status: 403 })
    }

    const { rows } = await req.json() as {
      rows: {
        ho_ten: string
        sdt: string
        email?: string
        dia_chi_hd?: string
        dia_chi_ct?: string
        pipeline?: string
        nguon_kh?: string
        loai_hinh_nha?: string
        nguon_nuoc?: string
        muc_uu_tien?: string
        bao_gia?: number
        noi_dung?: string
        nguoi_phu_trach?: string
      }[]
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu' }, { status: 400 })
    }

    const toCreate = rows
      .filter(r => r.ho_ten?.trim() && r.sdt?.trim())
      .map(r => {
        const fields: Record<string, unknown> = {
          'Họ tên KH':          r.ho_ten.trim(),
          'SĐT di động':        r.sdt.trim(),
          'Trạng thái pipeline': r.pipeline || 'Lead mới',
          'Ngày liên hệ đầu':   Date.now(),
        }
        if (r.email?.trim())           fields['Email'] = r.email.trim()
        if (r.dia_chi_hd?.trim())      fields['Địa chỉ ký HĐ'] = r.dia_chi_hd.trim()
        if (r.dia_chi_ct?.trim())      fields['Địa chỉ công trình'] = r.dia_chi_ct.trim()
        if (r.nguon_kh?.trim())        fields['Nguồn KH'] = r.nguon_kh.trim()
        if (r.loai_hinh_nha?.trim())   fields['Loại hình nhà'] = r.loai_hinh_nha.trim()
        if (r.nguon_nuoc?.trim())      fields['Nguồn nước'] = r.nguon_nuoc.trim()
        if (r.muc_uu_tien?.trim())     fields['Mức ưu tiên'] = r.muc_uu_tien.trim()
        if (r.bao_gia)                 fields['Giá trị báo giá (VNĐ)'] = String(r.bao_gia)
        if (r.noi_dung?.trim())        fields['Nội dung trao đổi'] = r.noi_dung.trim()
        if (r.nguoi_phu_trach?.trim()) fields['Người phụ trách'] = r.nguoi_phu_trach.trim()
        return fields
      })

    if (toCreate.length === 0) {
      return NextResponse.json({ error: 'Không có dòng hợp lệ (cần Họ tên + SĐT)' }, { status: 400 })
    }

    let created = 0
    for (const batch of chunk(toCreate, CHUNK)) {
      await batchCreateRecords(TABLES.CUSTOMERS, batch)
      created += batch.length
    }

    return NextResponse.json({ created, skipped: rows.length - created })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/lark/customers/import:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
