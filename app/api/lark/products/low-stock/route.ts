import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/lark/products/low-stock ────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'ceo', 'director'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('products')
      .select('id, ten_sp, ma_sp, phan_loai, nhom_sp, so_luong_ton, canh_bao_ton_thap, con_hang')
      .eq('con_hang', true)
      .not('canh_bao_ton_thap', 'is', null)
      .filter('so_luong_ton', 'lte', 'canh_bao_ton_thap')
      .order('so_luong_ton', { ascending: true })
    if (error) throw error

    return NextResponse.json({ data: data ?? [], count: (data ?? []).length })
  } catch (err) {
    console.error('GET /api/lark/products/low-stock:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
