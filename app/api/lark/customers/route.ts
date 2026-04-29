import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Customer {
  record_id:          string        // = Supabase id.toString()
  id:                 number
  ho_ten:             string
  sdt:                string
  sdt_khac:           string
  email:              string
  ma_kh:              string
  dia_chi_hd:         string
  dia_chi_ct:         string
  pipeline:           string
  nguoi_phu_trach:    string        // full_name (for display)
  nguoi_phu_trach_id: string | null // UUID
  nguon_kh:           string
  doi_tac_gt:         string
  doi_tac_id:         string | null  // UUID partner (thay thế doi_tac_gt text)
  loai_hinh_nha:      string
  nguon_nuoc:         string
  san_pham_quan_tam:  string[]
  bao_gia:            number
  muc_uu_tien:        string
  ngay_lien_he_dau:   number | null // ms timestamp (UI compat)
  ngay_cap_nhat:      number | null // ms timestamp (UI compat)
  noi_dung:           string
  ly_do_tu_choi:      string
  nhom_dv:            string
  tien_do_ct:         string
  khu_vuc:            string
  loai_kh:            string   // 'B2C' | 'Đại lý' | 'Dự án' | ''
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMs(d: string | null | undefined): number | null {
  if (!d) return null
  const ms = new Date(d).getTime()
  return isNaN(ms) ? null : ms
}

function mapRow(c: any): Customer {
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
    doi_tac_id:         c.doi_tac_id        ?? null,
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
    loai_kh:            c.loai_kh           ?? '',
  }
}

// ─── GET /api/lark/customers ──────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role, khu_vuc')
      .eq('id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    let query = supabase
      .from('customers')
      .select('*, profiles!nguoi_phu_trach(id, full_name)')
      .order('updated_at', { ascending: false })

    // RLS enforces security; explicit filters improve query performance
    if (profile.role === 'sales' || profile.role === 'partner') {
      query = query.eq('nguoi_phu_trach', profile.id)
    } else if ((profile.role === 'tech' || profile.role === 'logistics') && profile.khu_vuc) {
      query = query.eq('khu_vuc', profile.khu_vuc)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({
      customers: (data ?? []).map(mapRow),
      role: profile.role,
    })
  } catch (err) {
    console.error('GET /api/lark/customers:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/lark/customers ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

    const body = await req.json()
    const {
      ho_ten, sdt, sdt_khac, email, dia_chi_hd, dia_chi_ct,
      pipeline, nguoi_phu_trach, nguon_kh, doi_tac_gt, doi_tac_id,
      loai_hinh_nha, nguon_nuoc, san_pham_quan_tam,
      bao_gia, muc_uu_tien, noi_dung, nhom_dv, khu_vuc, loai_kh,
    } = body

    if (!ho_ten || !sdt) {
      return NextResponse.json({ error: 'Họ tên và SĐT là bắt buộc' }, { status: 400 })
    }

    // Sales/partner: always assign to themselves
    const assigneeId = (profile.role === 'sales' || profile.role === 'partner')
      ? profile.id
      : (nguoi_phu_trach || profile.id)

    // Nếu partner tạo KH → tự set doi_tac_id = chính mình
    const resolvedDoiTacId = profile.role === 'partner'
      ? profile.id
      : (doi_tac_id || null)

    const { data, error } = await supabase
      .from('customers')
      .insert({
        ho_ten,
        sdt,
        sdt_khac:          sdt_khac       || null,
        email:             email           || null,
        dia_chi_hd:        dia_chi_hd     || null,
        dia_chi_ct:        dia_chi_ct     || null,
        pipeline:          pipeline       || 'Lead mới',
        nguoi_phu_trach:   assigneeId,
        nguon_kh:          nguon_kh       || null,
        doi_tac_gt:        doi_tac_gt     || null,
        doi_tac_id:        resolvedDoiTacId,
        loai_hinh_nha:     loai_hinh_nha  || null,
        nguon_nuoc:        nguon_nuoc     || null,
        san_pham_quan_tam: san_pham_quan_tam ?? [],
        bao_gia:           bao_gia        ?? 0,
        muc_uu_tien:       muc_uu_tien    || 'Trung bình',
        noi_dung:          noi_dung       || null,
        nhom_dv:           nhom_dv        || null,
        khu_vuc:           khu_vuc        || null,
        loai_kh:           loai_kh        || null,
        ngay_lien_he_dau:  new Date().toISOString().split('T')[0],
      })
      .select('*, profiles!nguoi_phu_trach(id, full_name)')
      .single()

    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: profile.full_name ?? '',
      action:    'customer_created',
      entity:    'customer',
      detail:    `${ho_ten} — ${sdt}`,
    })

    return NextResponse.json({ customer: mapRow(data) }, { status: 201 })
  } catch (err) {
    console.error('POST /api/lark/customers:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
