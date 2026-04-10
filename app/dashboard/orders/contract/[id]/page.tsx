export const dynamic = 'force-dynamic'
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { CONTRACT_STATUS_COLORS } from '@/lib/lark/tables'
import type { Contract } from '@/app/api/lark/orders/route'

const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '—'
const fmtDate  = (ms: number | null) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === 'undefined' || value === 'null' || value === '0₫') return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  )
}

const CONTRACT_STATUSES = [
  'Đã ký - Chờ TT đợt 1',
  'Đã ký - Chờ TT đợt 2',
  'Đã ký - Chờ TT đợt 3',
  'Đang thi công',
  'Chờ nghiệm thu',
  'Hoàn thành',
  'Hủy hợp đồng',
]

export default function ContractDetailPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading]   = useState(true)
  const [showStatus, setShowStatus] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    fetch(`/api/lark/orders/contract/${id}`)
      .then(r => r.json())
      .then(d => setContract(d.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const updateStatus = async (status: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/lark/orders/contract/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trang_thai: status }),
      })
      if (!res.ok) throw new Error()
      setContract(prev => prev ? { ...prev, trang_thai: status } : prev)
      setSuccessMsg('Đã cập nhật')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch {} finally { setUpdating(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><span className="crm-spinner" /></div>
  if (!contract) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 text-sm">Không tìm thấy hợp đồng</p>
      <button onClick={() => router.back()} className="text-blue-600 text-sm font-semibold">← Quay lại</button>
    </div>
  )

  const sc = CONTRACT_STATUS_COLORS[contract.trang_thai] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800">{contract.khach_hang}</h1>
          <p className="text-xs text-gray-400">{contract.ma_hd}</p>
        </div>
        {successMsg && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* Status */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">TRẠNG THÁI HỢP ĐỒNG</p>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-xl ${sc.bg} ${sc.text}`}>
              {contract.trang_thai || '—'}
            </span>
            <button onClick={() => setShowStatus(true)} disabled={updating}
              className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-xl">
              {updating ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </div>
        </div>

        {/* Financial */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">GIÁ TRỊ HỢP ĐỒNG</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Giá trị HĐ</span>
              <span className="text-xl font-bold text-green-600">{fmtMoney(contract.gia_tri_hd)}</span>
            </div>
            {contract.hh_kinh_doanh > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">HH kinh doanh</span>
                <span className="text-sm font-semibold text-blue-600">{fmtMoney(contract.hh_kinh_doanh)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:${contract.sdt}`}
            className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-2">
            <span className="text-xl">📞</span>
            <div>
              <p className="text-xs font-semibold text-gray-700">Gọi điện</p>
              <p className="text-xs text-gray-400">{contract.sdt}</p>
            </div>
          </a>
          <a href={`https://zalo.me/${contract.sdt.replace(/^0/, '84')}`} target="_blank" rel="noopener noreferrer"
            className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-2">
            <span className="text-xl">💬</span>
            <div>
              <p className="text-xs font-semibold text-gray-700">Zalo</p>
              <p className="text-xs text-gray-400">{contract.sdt}</p>
            </div>
          </a>
        </div>

        {/* Details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">CHI TIẾT HỢP ĐỒNG</p>
          <InfoRow label="Khách hàng" value={contract.khach_hang} />
          <InfoRow label="Số điện thoại" value={contract.sdt} />
          <InfoRow label="Người phụ trách" value={contract.nguoi_phu_trach} />
          <InfoRow label="Sản phẩm chính" value={contract.san_pham.join(', ')} />
          <InfoRow label="Địa chỉ công trình" value={contract.dia_chi_ct} />
          <InfoRow label="Ngày ký" value={fmtDate(contract.ngay_ky)} />
          <InfoRow label="Ngày giao DK" value={fmtDate(contract.ngay_giao_dk)} />
          {contract.ghi_chu && <InfoRow label="Ghi chú" value={contract.ghi_chu} />}
        </div>
      </div>

      {/* Status picker */}
      {showStatus && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={e => e.target === e.currentTarget && setShowStatus(false)}>
          <div className="bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Cập nhật trạng thái</h2>
            </div>
            <div className="p-4 space-y-2 pb-8">
              {CONTRACT_STATUSES.map(s => {
                const c = CONTRACT_STATUS_COLORS[s] ?? { bg: 'bg-gray-50', text: 'text-gray-600' }
                return (
                  <button key={s} onClick={() => { updateStatus(s); setShowStatus(false) }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left ${
                      contract.trang_thai === s ? `${c.bg} ${c.text}` : 'hover:bg-gray-50 text-gray-700'
                    }`}>
                    <span className="text-sm font-medium">{s}</span>
                    {contract.trang_thai === s && <span className="text-xs">✓</span>}
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
