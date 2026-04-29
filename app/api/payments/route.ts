import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// ─── GET /api/payments?customer_record_id= ───────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const customer_record_id = req.nextUrl.searchParams.get('customer_record_id')
    if (!customer_record_id) {
      return NextResponse.json({ error: 'Thiếu customer_record_id' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('payment_records')
      .select('*')
      .eq('customer_record_id', customer_record_id)
      .is('deleted_at', null)
      .order('installment', { ascending: true })

    if (error) throw error

    // Sales chỉ thấy trạng thái, không thấy số tiền
    const sanitized = me.role === 'sales'
      ? (data ?? []).map(r => ({ ...r, amount: null }))
      : (data ?? [])

    return NextResponse.json({ data: sanitized })
  } catch (err) {
    console.error('GET /api/payments:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── POST /api/payments — Tạo đợt thanh toán mới ────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const CAN_WRITE_PAYMENT = ['accountant', 'admin', 'ceo', 'director']
    if (!CAN_WRITE_PAYMENT.includes(me.role)) {
      return NextResponse.json({ error: 'Chỉ kế toán/admin/CEO/giám đốc mới thêm được thanh toán' }, { status: 403 })
    }

    const body = await req.json()
    const {
      customer_record_id,
      customer_name,
      nguoi_phu_trach,
      contract_record_id,
      installment,
      percent,
      due_date,
      notes,
    } = body

    // FIN-12: chỉ accountant/admin/ceo/director mới được set amount
    const amount = CAN_WRITE_PAYMENT.includes(me.role) ? body.amount : undefined

    if (!customer_record_id || !installment) {
      return NextResponse.json({ error: 'Thiếu customer_record_id hoặc installment' }, { status: 400 })
    }
    if (![1, 2, 3].includes(Number(installment))) {
      return NextResponse.json({ error: 'installment phải là 1, 2 hoặc 3' }, { status: 400 })
    }

    // FIN-02: idempotency — reject nếu cùng (customer_record_id, installment) được upsert trong 30s
    const thirtySecsAgo = new Date(Date.now() - 30_000).toISOString()
    const { data: recent } = await supabase
      .from('payment_records')
      .select('updated_at')
      .eq('customer_record_id', customer_record_id)
      .eq('installment', Number(installment))
      .is('deleted_at', null)
      .gt('updated_at', thirtySecsAgo)
      .maybeSingle()
    if (recent) {
      return NextResponse.json({ error: 'Yêu cầu vừa được xử lý, vui lòng đợi 30 giây' }, { status: 429 })
    }

    // Lookup customer: lấy id + nguoi_phu_trach (UUID của sales phụ trách)
    const { data: cust } = await supabase
      .from('customers').select('id, nguoi_phu_trach').eq('id', Number(customer_record_id)).maybeSingle()
    const customerId         = cust?.id               ?? null
    const nguoi_phu_trach_id = cust?.nguoi_phu_trach  ?? null  // UUID — dùng cho KPI queries

    const { data: record, error } = await supabase
      .from('payment_records')
      .upsert({
        customer_record_id,
        customer_id:          customerId,
        customer_name:        customer_name      ?? null,
        nguoi_phu_trach:      nguoi_phu_trach    ?? null,
        nguoi_phu_trach_id,
        contract_record_id:   contract_record_id ?? null,
        installment:        Number(installment),
        percent:            percent != null ? Number(percent) : null,
        amount:             amount  != null ? Number(amount)  : null,
        due_date:           due_date ?? null,
        is_paid:            false,
        notes:              notes ?? null,
        created_by:         user.id,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'customer_record_id,installment' })
      .select()
      .single()

    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'payment_created',
      entity:    'payment',
      detail:    `${customer_name ?? customer_record_id} — Đợt ${installment} (${percent ?? '?'}%): ${amount ?? 'chưa nhập'}đ`,
    })

    return NextResponse.json({ success: true, data: record })
  } catch (err) {
    console.error('POST /api/payments:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── PATCH /api/payments — Cập nhật đợt thanh toán ──────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    if (!['accountant', 'admin', 'ceo', 'director'].includes(me.role)) {
      return NextResponse.json({ error: 'Chỉ kế toán/admin/CEO/giám đốc mới sửa được thanh toán' }, { status: 403 })
    }

    const body = await req.json()
    const { id, is_paid, paid_date, amount, due_date, percent, notes } = body
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (is_paid   !== undefined) updates.is_paid   = is_paid
    if (paid_date !== undefined) updates.paid_date  = paid_date
    if (amount    !== undefined) updates.amount     = amount != null ? Number(amount) : null
    if (due_date  !== undefined) updates.due_date   = due_date
    if (percent   !== undefined) updates.percent    = percent != null ? Number(percent) : null
    if (notes     !== undefined) updates.notes      = notes

    const { data: record, error } = await supabase
      .from('payment_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'payment_updated',
      entity:    'payment',
      detail:    `ID ${id}: ${JSON.stringify(updates)}`,
      after:     updates,
    })

    return NextResponse.json({ success: true, data: record })
  } catch (err) {
    console.error('PATCH /api/payments:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// ─── DELETE /api/payments?id= — Xóa đợt thanh toán (soft-delete) ────────────

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    const isManager = ['admin', 'ceo', 'director'].includes(me.role)

    if (!isManager) {
      // ACC-07: accountant xóa được nếu is_paid=false VÀ created_by=me.id
      if (me.role !== 'accountant') {
        return NextResponse.json({ error: 'Không có quyền xóa' }, { status: 403 })
      }
      const { data: rec } = await supabase
        .from('payment_records')
        .select('is_paid, created_by')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()
      if (!rec) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
      if (rec.is_paid) {
        return NextResponse.json({ error: 'Không thể xóa đợt đã thu tiền' }, { status: 403 })
      }
      if (rec.created_by !== user.id) {
        return NextResponse.json({ error: 'Chỉ xóa được đợt do chính mình tạo' }, { status: 403 })
      }
    }

    // FIN-03: soft-delete
    const { error } = await supabase
      .from('payment_records')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error

    void logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'payment_deleted',
      entity:    'payment',
      detail:    `ID ${id}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/payments:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
