import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PIPELINE_STAGES } from '@/lib/lark/tables'

const VALID_PIPELINE = new Set(PIPELINE_STAGES)
const VALID_LOAI_KH  = new Set(['B2C', 'Đại lý', 'Dự án'])
const VALID_KHU_VUC  = new Set(['Miền Nam', 'Miền Bắc', 'Miền Trung'])

// ─── Parse ngày dd/mm/yyyy hoặc yyyy-mm-dd → ISO string ──────────────────────
function parseDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()
  // dd/mm/yyyy
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) {
    const [, d, mo, y] = m1
    const dt = new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`)
    return isNaN(dt.getTime()) ? null : dt.toISOString().split('T')[0]
  }
  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m2) {
    const dt = new Date(s)
    return isNaN(dt.getTime()) ? null : s
  }
  return null
}

// ─── POST /api/lark/customers/import ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'ceo', 'director'].includes(profile.role)) {
      return NextResponse.json({ error: 'Chỉ Admin / CEO / Director mới được import' }, { status: 403 })
    }

    const { rows } = await req.json() as {
      rows: {
        ho_ten:            string
        sdt:               string
        sdt_khac?:         string
        email?:            string
        dia_chi_hd?:       string
        dia_chi_ct?:       string
        pipeline?:         string
        nguon_kh?:         string
        loai_hinh_nha?:    string
        nguon_nuoc?:       string
        muc_uu_tien?:      string
        bao_gia?:          number
        noi_dung?:         string
        nguoi_phu_trach?:  string
        loai_kh?:          string
        khu_vuc?:          string
        nhom_dv?:          string
        ngay_lien_he_dau?: string
      }[]
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu' }, { status: 400 })
    }

    const service = createServiceClient()

    // ── 1. Load danh sách nhân viên → map tên → UUID ─────────────────────────
    const { data: staffList } = await service
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .in('role', ['sales', 'tech', 'logistics', 'admin', 'ceo', 'director'])

    const nameToId = new Map<string, string>()
    for (const s of (staffList ?? [])) {
      if (s.full_name) nameToId.set(s.full_name.trim().toLowerCase(), s.id)
    }

    // ── 2. Load SĐT đang có trong DB để detect trùng ─────────────────────────
    const { data: existingSdt } = await service
      .from('customers')
      .select('sdt')
    const sdtSet = new Set((existingSdt ?? []).map(r => r.sdt?.trim()))

    // ── 3. Parse và validate từng dòng ───────────────────────────────────────
    const today = new Date().toISOString().split('T')[0]
    const toInsert: Record<string, unknown>[] = []

    const skipped_invalid:   number[] = []  // dòng thiếu họ tên/SĐT (1-indexed)
    const skipped_duplicate: string[] = []  // SĐT trùng
    const unassigned_names:  string[] = []  // tên NV không match

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const lineNum = i + 2  // +2 vì dòng 1 là header

      // Bắt buộc: họ tên + SĐT
      if (!r.ho_ten?.trim() || !r.sdt?.trim()) {
        skipped_invalid.push(lineNum)
        continue
      }

      const sdt = r.sdt.trim().replace(/\s/g, '')

      // Kiểm tra trùng SĐT
      if (sdtSet.has(sdt)) {
        skipped_duplicate.push(sdt)
        continue
      }
      sdtSet.add(sdt)  // tránh trùng trong cùng batch

      // Resolve người phụ trách tên → UUID
      let nguoi_phu_trach: string | null = null
      if (r.nguoi_phu_trach?.trim()) {
        const key = r.nguoi_phu_trach.trim().toLowerCase()
        const found = nameToId.get(key)
        if (found) {
          nguoi_phu_trach = found
        } else {
          unassigned_names.push(`${r.ho_ten} (NV: ${r.nguoi_phu_trach})`)
        }
      }

      // Validate pipeline
      const pipeline = r.pipeline?.trim()
      const validPipeline = pipeline && VALID_PIPELINE.has(pipeline as typeof PIPELINE_STAGES[number])
        ? pipeline
        : 'Lead mới'

      // Validate loai_kh
      const loai_kh = r.loai_kh?.trim()
      const validLoaiKh = loai_kh && VALID_LOAI_KH.has(loai_kh) ? loai_kh : null

      // Validate khu_vuc
      const khu_vuc = r.khu_vuc?.trim()
      const validKhuVuc = khu_vuc && VALID_KHU_VUC.has(khu_vuc) ? khu_vuc : null

      // Parse ngày liên hệ đầu
      const ngay_lien_he_dau = parseDate(r.ngay_lien_he_dau) ?? today

      toInsert.push({
        ho_ten:            r.ho_ten.trim(),
        sdt,
        sdt_khac:          r.sdt_khac?.trim()       || null,
        email:             r.email?.trim()           || null,
        dia_chi_hd:        r.dia_chi_hd?.trim()      || null,
        dia_chi_ct:        r.dia_chi_ct?.trim()      || null,
        pipeline:          validPipeline,
        muc_uu_tien:       r.muc_uu_tien?.trim()     || 'Trung bình',
        nguoi_phu_trach,
        khu_vuc:           validKhuVuc,
        nguon_kh:          r.nguon_kh?.trim()        || null,
        loai_hinh_nha:     r.loai_hinh_nha?.trim()   || null,
        nguon_nuoc:        r.nguon_nuoc?.trim()       || null,
        bao_gia:           r.bao_gia                 ?? 0,
        noi_dung:          r.noi_dung?.trim()         || null,
        nhom_dv:           r.nhom_dv?.trim()          || null,
        loai_kh:           validLoaiKh,
        ngay_lien_he_dau,
        created_by:        profile.id,
      })
    }

    if (toInsert.length === 0) {
      return NextResponse.json({
        created:            0,
        skipped_invalid:    skipped_invalid.length,
        skipped_duplicate:  skipped_duplicate.length,
        unassigned:         0,
        details: {
          invalid_rows:      skipped_invalid,
          duplicate_sdts:    skipped_duplicate,
          unassigned_names,
        },
        error: 'Không có dòng hợp lệ để import',
      }, { status: 400 })
    }

    // ── 4. Batch insert vào Supabase (serviceClient bypass RLS) ──────────────
    const CHUNK = 50
    let created = 0
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const batch = toInsert.slice(i, i + CHUNK)
      const { error } = await service.from('customers').insert(batch)
      if (error) throw error
      created += batch.length
    }

    return NextResponse.json({
      created,
      skipped_invalid:   skipped_invalid.length,
      skipped_duplicate: skipped_duplicate.length,
      unassigned:        unassigned_names.length,
      details: {
        invalid_rows:    skipped_invalid,
        duplicate_sdts:  skipped_duplicate,
        unassigned_names,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/lark/customers/import:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
