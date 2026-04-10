'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { PeriodicService } from '@/app/api/lark/maintenance/_mappers'

const fmtDate = (ms: number | null) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === 'undefined' || value === 'null') return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  )
}

function addMonths(ms: number, months: number): number {
  const d = new Date(ms)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

export default function PeriodicDetailPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [item, setItem]           = useState<PeriodicService | null>(null)
  const [loading, setLoading]     = useState(true)
  const [markingDone, setMarkingDone] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [successMsg, setSuccessMsg]   = useState('')

  useEffect(() => {
    fetch(`/api/lark/maintenance/periodic/${id}`)
      .then(r => r.json())
      .then(d => setItem(d.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const markDone = async () => {
    if (!item) return
    setMarkingDone(true)
    const now = Date.now()
    const nextMs = addMonths(now, item.chu_ky || 6)
    try {
      const res = await fetch(`/api/lark/maintenance/periodic/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lan_bd_gan_nhat:  now,
          lan_bd_tiep_theo: nextMs,
          trang_thai: 'Đã bảo dưỡng',
        }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setItem(d.data)
      setShowConfirm(false)
      setSuccessMsg('Đã đánh dấu hoàn thành!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch {
      setSuccessMsg('')
    } finally { setMarkingDone(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <span className="crm-spinner" />
    </div>
  )
  if (!item) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 text-sm">Không tìm thấy lịch bảo dưỡng</p>
      <button onClick={() => router.back()} className="text-blue-600 text-sm font-semibold">← Quay lại</button>
    </div>
  )

  const isOverdue = item.so_ngay_con_lai < 0
  const isUrgent  = item.so_ngay_con_lai >= 0 && item.so_ngay_con_lai <= 30
  const urgBg   = isOverdue ? 'bg-red-50 border-red-200' : isUrgent ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-100'
  const urgText = isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-green-700'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800 truncate">{item.ten_kh || 'Bảo dưỡng định kỳ'}</h1>
          <p className="text-xs text-gray-400">{item.ma_bddk} · Chu kỳ {item.chu_ky} tháng</p>
        </div>
        {successMsg && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* Urgency + schedule */}
        <div className={`bg-white rounded-2xl p-4 shadow-sm border ${urgBg}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">
                {isOverdue ? 'QUÁ HẠN BẢO DƯỠNG' : 'LỊCH BẢO DƯỠNG TIẾP THEO'}
              </p>
              <p className={`text-xl font-bold mt-1 ${urgText}`}>{fmtDate(item.lan_bd_tiep_theo)}</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${urgText}`}>
                {Math.abs(item.so_ngay_con_lai)}
              </p>
              <p className="text-xs text-gray-400">{isOverdue ? 'ngày quá hạn' : 'ngày còn lại'}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Lần gần nhất: {fmtDate(item.lan_bd_gan_nhat)}</p>
          </div>
        </div>

        {/* Mark done CTA */}
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl text-sm shadow-sm active:scale-[0.98] transition-transform"
        >
          ✅ Đánh dấu đã bảo dưỡng hôm nay
        </button>

        {/* Quick actions */}
        {item.sdt && (
          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${item.sdt}`}
              className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-2">
              <span className="text-xl">📞</span>
              <div>
                <p className="text-xs font-semibold text-gray-700">Gọi điện</p>
                <p className="text-xs text-gray-400">{item.sdt}</p>
              </div>
            </a>
            <a href={`https://zalo.me/${item.sdt.replace(/^0/, '84')}`} target="_blank" rel="noopener noreferrer"
              className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-2">
              <span className="text-xl">💬</span>
              <div>
                <p className="text-xs font-semibold text-gray-700">Zalo</p>
                <p className="text-xs text-gray-400">{item.sdt}</p>
              </div>
            </a>
          </div>
        )}

        {/* Services + parts */}
        {(item.dich_vu.length > 0 || item.vat_tu.length > 0) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            {item.dich_vu.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5">DỊCH VỤ CẦN THỰC HIỆN</p>
                <div className="space-y-1">
                  {item.dich_vu.map((d, i) => (
                    <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>{d}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {item.vat_tu.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5">VẬT TƯ CẦN CHUẨN BỊ</p>
                <div className="space-y-1">
                  {item.vat_tu.map((v, i) => (
                    <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>{v}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">THÔNG TIN KHÁCH HÀNG</p>
          <InfoRow label="Khách hàng" value={item.ten_kh} />
          <InfoRow label="Số điện thoại" value={item.sdt} />
          <InfoRow label="NV phụ trách" value={item.nv_phu_trach} />
          <InfoRow label="Địa chỉ" value={item.dia_chi} />
          <InfoRow label="Sản phẩm đã lắp" value={item.san_pham_da_lap.join(', ')} />
          <InfoRow label="Chu kỳ" value={`${item.chu_ky} tháng`} />
          <InfoRow label="Trạng thái" value={item.trang_thai} />
          {item.ghi_chu && <InfoRow label="Ghi chú" value={item.ghi_chu} />}
        </div>
      </div>

      {/* Confirm mark done */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={e => e.target === e.currentTarget && setShowConfirm(false)}>
          <div className="bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-4 text-center space-y-3">
              <p className="text-2xl">✅</p>
              <h2 className="text-base font-bold text-gray-800">Xác nhận bảo dưỡng</h2>
              <p className="text-sm text-gray-500">
                Hệ thống sẽ ghi nhận ngày bảo dưỡng là hôm nay và tự tính lịch tiếp theo.
              </p>
              <div className="bg-gray-50 rounded-xl p-3 text-left space-y-1">
                <p className="text-xs text-gray-400">Lần BĐ gần nhất</p>
                <p className="text-sm font-semibold text-gray-800">
                  {new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-400 mt-1">Lần BĐ tiếp theo ({item.chu_ky} tháng)</p>
                <p className="text-sm font-semibold text-blue-600">
                  {new Date(addMonths(Date.now(), item.chu_ky || 6)).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="px-5 pb-8 grid grid-cols-2 gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">
                Hủy
              </button>
              <button onClick={markDone} disabled={markingDone}
                className="py-3 rounded-xl bg-green-600 text-white text-sm font-bold disabled:opacity-60">
                {markingDone ? 'Đang lưu...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
