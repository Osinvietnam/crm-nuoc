'use client'

import { useState } from 'react'
import type { Quote } from '@/app/api/lark/quotes/_mappers'
import { isDueForFollowUp } from '@/lib/hooks/useQuoteData'

export function QuoteFollowUpBanner({
  quotes,
  onClickQuote,
}: {
  quotes:       Quote[]
  onClickQuote: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const due = quotes.filter(isDueForFollowUp)
  if (due.length === 0) return null

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-2xl overflow-hidden mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-orange-100"
      >
        <div className="flex items-center gap-2">
          <span>⏰</span>
          <span className="text-sm font-bold text-orange-700">Cần follow-up hôm nay</span>
          <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {due.length}
          </span>
        </div>
        <span className="text-orange-400 text-xs font-medium">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-orange-100 divide-y divide-orange-100">
          {due.map(q => {
            const isOverdue = q.ngay_follow_up! < startOfToday.getTime()
            const daysLate  = isOverdue
              ? Math.floor((startOfToday.getTime() - q.ngay_follow_up!) / 86400000)
              : 0
            return (
              <button
                key={q.record_id}
                onClick={() => onClickQuote(q.record_id)}
                className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 active:bg-orange-100"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{q.khach_hang}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {q.ma_bao_gia}
                    {q.nguoi_phu_trach ? ` · ${q.nguoi_phu_trach}` : ''}
                  </p>
                  {q.ket_qua_follow_up && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">💬 {q.ket_qua_follow_up}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-orange-500'}`}>
                  {isOverdue ? `Trễ ${daysLate}n` : 'Hôm nay'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
