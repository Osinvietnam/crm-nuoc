import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const ALLOWED_CATEGORIES = ['luong', 'hang_hoa', 'van_chuyen', 'marketing', 'thue_van_phong', 'khac'] as const
const CAN_WRITE = ['admin', 'ceo', 'director', 'accountant']
const CAN_READ  = ['admin', 'ceo', 'director', 'accountant']

// ─── GET /api/finance/expenses?thang=4&nam=2026 ───────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!me || !CAN_READ.includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const thang = Number(req.nextUrl.searchParams.get('thang') ?? new Date().getMonth() + 1)
    const nam   = Number(req.nextUrl.searchParams.get('nam')   ?? new Date().getFullYear())

    const service = createServiceClient()
    const { data, error } = await service
      .from('expenses')
      .select('*')
      .eq('thang', thang)
      .eq('nam', nam)
      .order('category')

    if (error) throw error

    // Tổng hợp theo category
    const summary: Record<string, number> = {}
    for (const cat of ALLOWED_CATEGORIES) summary[cat] = 0
    for (const row of data ?? []) summary[row.category] = (summary[row.category] ?? 0) + (row.amount ?? 0)
    const tong = Object.values(summary).reduce((a, b) => a + b, 0)

    return NextResponse.json({ data: data ?? [], summary, tong, thang, nam })
  } catch (err) {
    console.error('GET /api/finance/expenses:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/finance/expenses — Tạo / upsert dòng chi phí ──────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !CAN_WRITE.includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const body = await req.json()
    const { category, amount, thang, nam, mo_ta } = body

    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'category không hợp lệ' }, { status: 400 })
    }
    if (!thang || !nam || amount == null) {
      return NextResponse.json({ error: 'Thiếu thang, nam hoặc amount' }, { status: 400 })
    }
    if (Number(amount) <= 0) {
      return NextResponse.json({ error: 'Số tiền phải lớn hơn 0' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('expenses')
      .upsert({
        category,
        amount:     Number(amount),
        thang:      Number(thang),
        nam:        Number(nam),
        mo_ta:      mo_ta ?? null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'category,thang,nam' })
      .select()
      .single()

    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? '',
      action:    'expense_created',
      entity:    'expense',
      detail:    `${category} T${thang}/${nam}: ${Number(amount).toLocaleString('vi-VN')}đ`,
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/finance/expenses:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/finance/expenses — Sửa dòng chi phí ─────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !CAN_WRITE.includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const body = await req.json()
    const { id, amount, mo_ta } = body
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (amount  !== undefined) updates.amount = Number(amount)
    if (mo_ta   !== undefined) updates.mo_ta  = mo_ta

    const service = createServiceClient()
    const { data, error } = await service.from('expenses').update(updates).eq('id', id).select().single()
    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? '',
      action:    'expense_updated',
      entity:    'expense',
      detail:    `Chi phí #${id}: ${Object.keys(updates).filter(k => k !== 'updated_at').join(', ')}`,
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('PATCH /api/finance/expenses:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/finance/expenses?id= ────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !['admin', 'ceo', 'accountant'].includes(me.role)) {
      return NextResponse.json({ error: 'Không có quyền xóa' }, { status: 403 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    // FIN-05: accountant chỉ xóa được expense của chính mình
    if (me.role === 'accountant') {
      const service = createServiceClient()
      const { data: exp } = await service.from('expenses').select('created_by').eq('id', id).maybeSingle()
      if (!exp) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
      if (exp.created_by !== user.id) {
        return NextResponse.json({ error: 'Chỉ xóa được chi phí do chính mình tạo' }, { status: 403 })
      }
    }

    const service = createServiceClient()
    const { error } = await service.from('expenses').delete().eq('id', id)
    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name ?? '',
      action:    'expense_deleted',
      entity:    'expense',
      detail:    `Xóa chi phí #${id}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/finance/expenses:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
