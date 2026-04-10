'use client'

import { useEffect, useState, useCallback } from 'react'

interface PaymentRecord {
  id: number
  installment: number
  percent: number | null
  amount: number | null
  due_date: string | null
  paid_date: string | null
  is_paid: boolean
  notes: string | null
}

interface Props {
  customerId: string
  customerName: string
  nguoiPhuTrach: string
  userRole: string
}

const DEFAULT_PERCENTS = [60, 35, 5]
const INSTALLMENT_LABELS = ['Đợt 1', 'Đợt 2', 'Đợt 3']

export function PaymentSection({ customerId, customerName, nguoiPhuTrach, userRole }: Props) {
  const [payments,      setPayments]      = useState<PaymentRecord[]>([])
  const [loading,       setLoading]       = useState(true)
  const [activeForm,    setActiveForm]    = useState<number | null>(null) // installment number
  const [formData,      setFormData]      = useState({ amount: '', due_date: '', notes: '' })
  const [saving,        setSaving]        = useState(false)
  const [showPaidForm,  setShowPaidForm]  = useState<number | null>(null)
  const [paidDate,      setPaidDate]      = useState('')
  const [markingPaid,   setMarkingPaid]   = useState(false)

  const canEdit = ['accountant', 'admin', 'ceo'].includes(userRole)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/payments?customer_record_id=${customerId}`)
      .then(r => r.json())
      .then(d => setPayments(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId])

  useEffect(() => { load() }, [load])

  const openForm = (installment: number) => {
    const existing = payments.find(p => p.installment === installment)
    setFormData({
      amount:   existing?.amount != null ? String(existing.amount) : '',
      due_date: existing?.due_date ?? '',
      notes:    existing?.notes ?? '',
    })
    setActiveForm(installment)
  }

  const savePayment = async () => {
    if (activeForm === null) return
    setSaving(true)
    try {
      const existing = payments.find(p => p.installment === activeForm)
      const amountNum = formData.amount ? Number(formData.amount.replace(/[^\d]/g, '')) || null : null

      if (existing) {
        await fetch('/api/payments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id:       existing.id,
            amount:   amountNum,
            due_date: formData.due_date || null,
            notes:    formData.notes    || null,
          }),
        })
      } else {
        await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_record_id: customerId,
            customer_name:      customerName,
            nguoi_phu_trach:    nguoiPhuTrach,
            installment:        activeForm,
            percent:            DEFAULT_PERCENTS[activeForm - 1],
            amount:             amountNum,
            due_date:           formData.due_date || null,
            notes:              formData.notes    || null,
          }),
        })
      }
      load()
      setActiveForm(null)
    } catch {}
    finally { setSaving(false) }
  }

  const confirmPaid = async () => {
    if (showPaidForm === null) return
    const existing = payments.find(p => p.installment === showPaidForm)
    if (!existing) return
    setMarkingPaid(true)
    try {
      await fetch('/api/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:        existing.id,
          is_paid:   true,
          paid_date: paidDate || new Date().toISOString().split('T')[0],
        }),
      })
      load()
      setShowPaidForm(null)
      setPaidDate('')
    } catch {}
    finally { setMarkingPaid(false) }
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400">THANH TOÁN</p>
          {loading && <span className="crm-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
        </div>

        <div className="divide-y divide-gray-50">
          {[1, 2, 3].map(n => {
            const payment = payments.find(p => p.installment === n)
            const pct     = payment?.percent ?? DEFAULT_PERCENTS[n - 1]

            return (
              <div key={n} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base ${
                    payment?.is_paid ? 'bg-green-100' : payment ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}>
                    {payment?.is_paid ? '✅' : payment ? '⏳' : '⬜'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {INSTALLMENT_LABELS[n - 1]} ({pct}%)
                      </span>
                      {payment?.is_paid && (
                        <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                          Đã TT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {payment
                        ? payment.amount != null
                          ? payment.amount.toLocaleString('vi-VN') + '₫'
                          : 'Chưa nhập số tiền'
                        : 'Chưa nhập'}
                      {payment?.is_paid && payment.paid_date
                        ? ` · ${new Date(payment.paid_date).toLocaleDateString('vi-VN')}`
                        : !payment?.is_paid && payment?.due_date
                          ? ` · DK: ${new Date(payment.due_date).toLocaleDateString('vi-VN')}`
                          : ''}
                    </p>
                  </div>

                  {canEdit && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      {!payment?.is_paid && (
                        <button
                          onClick={() => openForm(n)}
                          className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg font-medium active:bg-blue-100"
                        >
                          {payment ? 'Sửa' : '+ Nhập'}
                        </button>
                      )}
                      {payment && !payment.is_paid && (
                        <button
                          onClick={() => setShowPaidForm(n)}
                          className="text-xs text-green-600 bg-green-50 px-2.5 py-1.5 rounded-lg font-medium active:bg-green-100"
                        >
                          Đã TT
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Form nhập / sửa thanh toán */}
      {activeForm !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={e => e.target === e.currentTarget && setActiveForm(null)}
        >
          <div className="bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">
                {INSTALLMENT_LABELS[activeForm - 1]} — {DEFAULT_PERCENTS[activeForm - 1]}%
              </h2>
              <button onClick={() => setActiveForm(null)} className="text-gray-400 p-1 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4 pb-8">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Số tiền (VNĐ)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.amount}
                  onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="Ví dụ: 120000000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Ngày dự kiến TT</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Ghi chú</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ghi chú (tùy chọn)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                onClick={savePayment}
                disabled={saving}
                className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-2xl active:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form xác nhận đã TT */}
      {showPaidForm !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={e => e.target === e.currentTarget && setShowPaidForm(null)}
        >
          <div className="bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Xác nhận đã thanh toán</h2>
              <button onClick={() => setShowPaidForm(null)} className="text-gray-400 p-1 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4 pb-8">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Ngày thanh toán thực tế</label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={e => setPaidDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <p className="text-xs text-gray-400 mt-1.5">Để trống = lấy ngày hôm nay</p>
              </div>
              <button
                onClick={confirmPaid}
                disabled={markingPaid}
                className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-2xl active:bg-green-700 disabled:opacity-50"
              >
                {markingPaid ? 'Đang lưu...' : '✅ Xác nhận đã thanh toán'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
