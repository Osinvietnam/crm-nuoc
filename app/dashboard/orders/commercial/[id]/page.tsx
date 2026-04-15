'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { COMMERCIAL_STATUS_COLORS } from '@/lib/lark/tables'
import type { CommercialOrder } from '@/app/api/lark/orders/route'

const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '—'
const fmtDate  = (ms: number | null) => ms
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

const COMMERCIAL_STATUSES = [
  'Chờ xác nhận',
  'Đang chuẩn bị',
  'Đang giao',
  'Đã giao',
  'Đã thanh toán',
  'Ghi nợ',
  'Hủy',
]

export default function CommercialDetailPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [order, setOrder]     = useState<CommercialOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [showStatus, setShowStatus] = useState(false)
  const [updating, setUpdating]     = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    fetch(`/api/lark/orders/commercial/${id}`)
      .then(r => r.json())
      .then(d => setOrder(d.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const updateStatus = async (status: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/lark/orders/commercial/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trang_thai: status }),
      })
      if (!res.ok) throw new Error()
      setOrder(prev => prev ? { ...prev, trang_thai: status } : prev)
      setSuccessMsg('Đã cập nhật')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch {} finally { setUpdating(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><span className="crm-spinner" /></div>
  if (!order)  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 text-sm">Không tìm thấy đơn hàng</p>
      <button onClick={() => router.back()} className="text-blue-600 text-sm font-semibold">← Quay lại</button>
    </div>
  )

  const sc = COMMERCIAL_STATUS_COLORS[order.trang_thai] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800 truncate">{order.ten_kh}</h1>
          <p className="text-xs text-gray-400">{order.ma_don} · {order.loai_khach}</p>
        </div>
        {successMsg && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* Status */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">TRẠNG THÁI ĐƠN HÀNG</p>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-xl ${sc.bg} ${sc.text}`}>
              {order.trang_thai || '—'}
            </span>
            <button onClick={() => setShowStatus(true)} disabled={updating}
              className="text-xs text-blue-600 font-semibold bg-blue-50 px-4 py-2 rounded-xl">
              {updating ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">TÓM TẮT ĐƠN</p>
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-sm font-semibold text-gray-800">{order.san_pham}</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Số lượng</span>
              <span className="font-medium">{order.so_luong} {order.don_vi}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Đơn giá</span>
              <span className="font-medium">{fmtMoney(order.don_gia)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="text-sm font-semibold text-gray-700">Tổng tiền</span>
              <span className="text-lg font-bold text-green-600">{fmtMoney(order.tong_tien)}</span>
            </div>
          </div>
        </div>

        {/* Quick call */}
        {order.sdt && (
          <a href={`tel:${order.sdt}`}
            className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <span className="text-2xl">📞</span>
            <div>
              <p className="text-sm font-semibold text-gray-700">{order.ten_kh}</p>
              <p className="text-xs text-gray-400">{order.sdt}</p>
            </div>
          </a>
        )}

        {/* Details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">CHI TIẾT ĐƠN HÀNG</p>
          <InfoRow label="Mã đơn" value={order.ma_don} />
          <InfoRow label="Ngày đặt" value={fmtDate(order.ngay_dat)} />
          <InfoRow label="Loại khách" value={order.loai_khach} />
          <InfoRow label="Tỉnh / Thành" value={order.tinh_thanh} />
          <InfoRow label="Mã SP/VT" value={order.ma_sp} />
          <InfoRow label="Phương thức TT" value={order.phuong_thuc_tt} />
          <InfoRow label="Ngày giao DK" value={fmtDate(order.ngay_giao_dk)} />
          <InfoRow label="Ngày giao thực" value={fmtDate(order.ngay_giao_thuc)} />
          <InfoRow label="Người phụ trách" value={order.nguoi_phu_trach} />
          {order.ghi_chu && <InfoRow label="Ghi chú" value={order.ghi_chu} />}
        </div>
      </div>

      {showStatus && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={e => e.target === e.currentTarget && setShowStatus(false)}>
          <div className="bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Cập nhật trạng thái</h2>
            </div>
            <div className="p-4 space-y-2 pb-8">
              {COMMERCIAL_STATUSES.map(s => {
                const c = COMMERCIAL_STATUS_COLORS[s] ?? { bg: 'bg-gray-50', text: 'text-gray-600' }
                return (
                  <button key={s} onClick={() => { updateStatus(s); setShowStatus(false) }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left ${
                      order.trang_thai === s ? `${c.bg} ${c.text}` : 'hover:bg-gray-50 text-gray-700'
                    }`}>
                    <span className="text-sm font-medium">{s}</span>
                    {order.trang_thai === s && <span className="text-xs">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
