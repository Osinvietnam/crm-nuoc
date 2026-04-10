import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createRecord, updateRecord } from '@/lib/lark/client'
import { TABLES } from '@/lib/lark/tables'
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

    const { searchParams } = new URL(req.url)
    const customer_record_id = searchParams.get('customer_record_id')
    if (!customer_record_id) {
      return NextResponse.json({ error: 'Thiếu customer_record_id' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('payment_records')
      .select('*')
      .eq('customer_record_id', customer_record_id)
      .order('installment', { ascending: true })

    if (error) throw error

    // Sales chỉ thấy trạng thái, không thấy số tiền
    const isSales = me.role === 'sales'
    const sanitized = isSales
      ? (data ?? []).map(r => ({
          ...r,
          amount: null,
        }))
      : (data ?? [])

    return NextResponse.json({ data: sanitized })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('GET /api/payments:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
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

    const canEdit = ['accountant', 'admin', 'ceo'].includes(me.role)
    if (!canEdit) {
      return NextResponse.json({ error: 'Chỉ kế toán/admin/CEO mới thêm được thanh toán' }, { status: 403 })
    }

    const body = await req.json()
    const {
      customer_record_id,
      customer_name,
      nguoi_phu_trach,
      contract_record_id,
      installment,
      percent,
      amount,
      due_date,
      notes,
    } = body

    if (!customer_record_id || !installment) {
      return NextResponse.json({ error: 'Thiếu customer_record_id hoặc installment' }, { status: 400 })
    }
    if (![1, 2, 3].includes(Number(installment))) {
      return NextResponse.json({ error: 'installment phải là 1, 2 hoặc 3' }, { status: 400 })
    }

    const service = createServiceClient()

    // Upsert vào Supabase
    const { data: record, error } = await service
      .from('payment_records')
      .upsert({
        customer_record_id,
        customer_name:      customer_name    ?? null,
        nguoi_phu_trach:    nguoi_phu_trach  ?? null,
        contract_record_id: contract_record_id ?? null,
        installment:        Number(installment),
        percent:            percent != null ? Number(percent) : null,
        amount:             amount  != null ? Number(amount)  : null,
        due_date:           due_date ?? null,
        is_paid:            false,
        notes:              notes ?? null,
        updated_at:         new Date().toISOString(),
      }, {
        onConflict: 'customer_record_id,installment',
      })
      .select()
      .single()

    if (error) throw error

    // Sync sang LarkBase PAYMENTS (nếu chưa có lark_record_id)
    let larkRecordId = record.lark_record_id ?? null
    if (!larkRecordId) {
      try {
        const larkRecord = await createRecord(TABLES.PAYMENTS, {
          'Khách hàng':     customer_name     ?? '',
          'Mã KH':          customer_record_id,
          'Lần TT':         Number(installment),
          'Tỷ lệ (%)':      percent != null ? Number(percent) : null,
          'Số tiền (VNĐ)':  amount  != null ? Number(amount)  : null,
          'Ngày dự kiến':   due_date ?? null,
          'Trạng thái':     'Chờ TT',
          'Người phụ trách': nguoi_phu_trach ?? '',
          'Ghi chú':        notes ?? '',
        })
        larkRecordId = larkRecord.record_id

        // Lưu lại lark_record_id vào Supabase
        await service
          .from('payment_records')
          .update({ lark_record_id: larkRecordId })
          .eq('id', record.id)
      } catch (larkErr) {
        // Không để lỗi LarkBase chặn response — ghi log thôi
        console.warn('POST /api/payments: LarkBase sync failed:', larkErr)
      }
    }

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'payment_created',
      entity:    'payment',
      detail:    `${customer_name ?? customer_record_id} — Đợt ${installment} (${percent ?? '?'}%): ${amount ?? 'chưa nhập'}đ`,
    })

    return NextResponse.json({ success: true, data: { ...record, lark_record_id: larkRecordId } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/payments:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
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

    const canEdit = ['accountant', 'admin', 'ceo'].includes(me.role)
    if (!canEdit) {
      return NextResponse.json({ error: 'Chỉ kế toán/admin/CEO mới sửa được thanh toán' }, { status: 403 })
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

    const service = createServiceClient()
    const { data: before } = await service
      .from('payment_records')
      .select('*')
      .eq('id', id)
      .single()

    const { data: record, error } = await service
      .from('payment_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Sync sang LarkBase nếu có lark_record_id
    if (before?.lark_record_id) {
      try {
        const larkFields: Record<string, unknown> = {}
        if (is_paid   !== undefined) larkFields['Trạng thái']   = is_paid ? 'Đã TT' : 'Chờ TT'
        if (paid_date !== undefined) larkFields['Ngày thực tế'] = paid_date
        if (amount    !== undefined) larkFields['Số tiền (VNĐ)'] = amount != null ? Number(amount) : null
        if (due_date  !== undefined) larkFields['Ngày dự kiến'] = due_date
        if (notes     !== undefined) larkFields['Ghi chú']      = notes

        if (Object.keys(larkFields).length > 0) {
          await updateRecord(TABLES.PAYMENTS, before.lark_record_id, larkFields)
        }
      } catch (larkErr) {
        console.warn('PATCH /api/payments: LarkBase sync failed:', larkErr)
      }
    }

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'payment_updated',
      entity:    'payment',
      detail:    `ID ${id}: ${JSON.stringify(updates)}`,
    })

    return NextResponse.json({ success: true, data: record })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('PATCH /api/payments:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── DELETE /api/payments?id= — Xóa đợt thanh toán (admin only) ─────────────

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!me || !['admin', 'ceo'].includes(me.role)) {
      return NextResponse.json({ error: 'Chỉ admin/CEO mới xóa được' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

    const service = createServiceClient()
    const { error } = await service
      .from('payment_records')
      .delete()
      .eq('id', id)

    if (error) throw error

    await logAudit(supabase, {
      user_id:   user.id,
      user_name: me.full_name,
      action:    'payment_deleted',
      entity:    'payment',
      detail:    `ID ${id}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('DELETE /api/payments:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
