import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function toMs(d: string | null | undefined): number | null {
  if (!d) return null
  const ms = new Date(d).getTime()
  return isNaN(ms) ? null : ms
}

function mapRow(c: any) {
  return {
    record_id:          c.id.toString(),
    id:                 c.id,
    ho_ten:             c.ho_ten            ?? '',
    sdt:                c.sdt               ?? '',
    sdt_khac:           c.sdt_khac          ?? '',
    email:              c.email             ?? '',
    ma_kh:              c.ma_kh             ?? '',
    dia_chi_hd:         c.dia_chi_hd        ?? '',
    dia_chi_ct:         c.dia_chi_ct        ?? '',
    pipeline:           c.pipeline          ?? 'Lead mới',
    nguoi_phu_trach:    c.profiles?.full_name ?? '',
    nguoi_phu_trach_id: c.nguoi_phu_trach   ?? null,
    nguon_kh:           c.nguon_kh          ?? '',
    doi_tac_gt:         c.doi_tac_gt        ?? '',
    loai_hinh_nha:      c.loai_hinh_nha     ?? '',
    nguon_nuoc:         c.nguon_nuoc        ?? '',
    san_pham_quan_tam:  c.san_pham_quan_tam ?? [],
    bao_gia:            c.bao_gia           ?? 0,
    muc_uu_tien:        c.muc_uu_tien       ?? 'Trung bình',
    ngay_lien_he_dau:   toMs(c.ngay_lien_he_dau),
    ngay_cap_nhat:      toMs(c.updated_at),
    noi_dung:           c.noi_dung          ?? '',
    ly_do_tu_choi:      c.ly_do_tu_choi     ?? '',
    nhom_dv:            c.nhom_dv           ?? '',
    tien_do_ct:         c.tien_do_ct        ?? '',
    khu_vuc:            c.khu_vuc           ?? '',
  }
}

// ─── GET /api/lark/customers/[id] ────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Support numeric Supabase id AND legacy lark_record_id
    const query = supabase
      .from('customers')
      .select('*, profiles!nguoi_phu_trach(id, full_name)')

    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

    return NextResponse.json({ customer: mapRow(data) })
  } catch (err) {
    console.error('GET /api/lark/customers/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/lark/customers/[id] ──────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const allowed = [
      'ho_ten', 'sdt', 'sdt_khac', 'email', 'dia_chi_hd', 'dia_chi_ct',
      'pipeline', 'nguoi_phu_trach', 'nguon_kh', 'doi_tac_gt', 'loai_hinh_nha',
      'nguon_nuoc', 'san_pham_quan_tam', 'bao_gia', 'muc_uu_tien', 'noi_dung',
      'ly_do_tu_choi', 'nhom_dv', 'tien_do_ct', 'khu_vuc',
    ]

    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Không có trường nào để cập nhật' }, { status: 400 })
    }

    const query = supabase
      .from('customers')
      .update(updates)
      .select('*, profiles!nguoi_phu_trach(id, full_name)')

    const { data, error } = await (/^\d+$/.test(id)
      ? query.eq('id', parseInt(id))
      : query.eq('lark_record_id', id)
    ).single()

    if (error) throw error
    return NextResponse.json({ customer: mapRow(data) })
  } catch (err) {
    console.error('PATCH /api/lark/customers/[id]:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
