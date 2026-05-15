import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const ADMIN_ROLES = ['admin', 'ceo', 'director']

// ─── GET /api/lark/products/[id]/inventory ────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('so_luong_ton, canh_bao_ton_thap, loai_sp, con_hang')
      .eq('id', id)
      .single()
    if (prodErr) throw prodErr

    const { data: logs, error: logErr } = await supabase
      .from('inventory_logs')
      .select('id, loai, so_luong, ton_sau, ghi_chu, created_at, created_by, profiles(full_name)')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (logErr) throw logErr

    const formattedLogs = (logs ?? []).map((l: any) => ({
      id: l.id,
      loai: l.loai,
      so_luong: l.so_luong,
      ton_sau: l.ton_sau,
      ghi_chu: l.ghi_chu,
      created_at: l.created_at,
      created_by: l.created_by,
      created_by_name: l.profiles?.full_name ?? null,
    }))

    return NextResponse.json({
      so_luong_ton: product.so_luong_ton ?? 0,
      canh_bao_ton_thap: product.canh_bao_ton_thap ?? 0,
      loai_sp: product.loai_sp ?? null,
      con_hang: product.con_hang ?? true,
      logs: formattedLogs,
    })
  } catch (err) {
    console.error('GET /api/lark/products/[id]/inventory:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/lark/products/[id]/inventory ──────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    const { id } = await params
    const body = await req.json()

    // ── Update canh_bao_ton_thap / loai_sp without role check (or apply role) ──
    const metaUpdates: Record<string, unknown> = {}
    if ('canh_bao_ton_thap' in body) metaUpdates.canh_bao_ton_thap = body.canh_bao_ton_thap
    if ('loai_sp' in body) metaUpdates.loai_sp = body.loai_sp

    if (Object.keys(metaUpdates).length > 0) {
      if (!ADMIN_ROLES.includes(profile?.role ?? '')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { error } = await supabase.from('products').update(metaUpdates).eq('id', id)
      if (error) throw error
      if (!('loai' in body)) {
        return NextResponse.json({ success: true })
      }
    }

    // ── Inventory movement (nhap / xuat / dieu_chinh) ──────────────────────────
    if (!('loai' in body)) {
      return NextResponse.json({ success: true })
    }

    if (!ADMIN_ROLES.includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { loai, so_luong, ghi_chu } = body as {
      loai: 'nhap' | 'xuat' | 'dieu_chinh'
      so_luong: number
      ghi_chu?: string
    }

    if (!['nhap', 'xuat', 'dieu_chinh'].includes(loai)) {
      return NextResponse.json({ error: 'loai không hợp lệ' }, { status: 400 })
    }
    if (loai === 'nhap' && (typeof so_luong !== 'number' || so_luong <= 0)) {
      return NextResponse.json({ error: 'so_luong phải > 0 khi nhập' }, { status: 400 })
    }
    if (loai !== 'nhap' && typeof so_luong !== 'number') {
      return NextResponse.json({ error: 'so_luong là bắt buộc' }, { status: 400 })
    }

    // Lấy tồn hiện tại
    const { data: current, error: fetchErr } = await supabase
      .from('products')
      .select('so_luong_ton')
      .eq('id', id)
      .single()
    if (fetchErr) throw fetchErr

    const currentTon: number = current.so_luong_ton ?? 0
    let delta: number
    if (loai === 'xuat') {
      delta = -Math.abs(so_luong)
    } else {
      delta = so_luong
    }
    const ton_moi = currentTon + delta

    if (ton_moi < 0) {
      return NextResponse.json({ error: 'Không đủ hàng trong kho' }, { status: 400 })
    }

    const { error: updateErr } = await supabase
      .from('products')
      .update({ so_luong_ton: ton_moi, con_hang: ton_moi > 0 })
      .eq('id', id)
    if (updateErr) throw updateErr

    const { data: log, error: logErr } = await supabase
      .from('inventory_logs')
      .insert({
        product_id: id,
        loai,
        so_luong: delta,
        ton_sau: ton_moi,
        ghi_chu: ghi_chu ?? null,
        created_by: user.id,
      })
      .select('*')
      .single()
    if (logErr) throw logErr

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: profile?.role ?? '',
      action:    'inventory_updated',
      entity:    'product',
      detail:    `SP #${id}: ${loai} ${delta > 0 ? '+' : ''}${delta} → tồn ${ton_moi}`,
    })
    return NextResponse.json({ so_luong_ton: ton_moi, log })
  } catch (err) {
    console.error('PATCH /api/lark/products/[id]/inventory:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
