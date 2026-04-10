export const dynamic = 'force-dynamic'
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Construction } from '@/app/api/lark/maintenance/_mappers'

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

const CONSTRUCTION_STATUSES = [
  'Đang thi công',
  'TT đợt 1',
  'TT đợt 2',
  'Nghiệm thu hoàn thành',
  'TT đợt 3',
  'Phát sinh',
]

function diffDays(target: number): number {
  return Math.ceil((target - Date.now()) / 86400000)
}

export default function ConstructionDetailPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [item, setItem]         = useState<Construction | null>(null)
  const [loading, setLoading]   = useState(true)
  const [showStatus, setShowStatus] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    fetch(`/api/lark/maintenance/construction/${id}`)
      .then(r => r.json())
      .then(d => setItem(d.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const updateStatus = async (status: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/lark/maintenance/construction/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trang_thai: status }),
      })
      if (!res.ok) throw new Error()
      setItem(prev => prev ? { ...prev, trang_thai: status } : prev)
      setSuccessMsg('Đã cập nhật')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch {} finally { setUpdating(false); setShowStatus(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <span className="crm-spinner" />
    </div>
  )
  if (!item) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 text-sm">Không tìm thấy công trình</p>
      <button onClick={() => router.back()} className="text-blue-600 text-sm font-semibold">← Quay lại</button>
    </div>
  )

  // CS deadline display
  const csDays = item.ngay_can_cs ? diffDays(item.ngay_can_cs) : null
  const csColor = item.cs_overdue
    ? 'text-red-600'
    : csDays !== null && csDays <= 7
      ? 'text-orange-600'
      : csDays !== null && csDays <= 14
        ? 'text-yellow-600'
        : 'text-green-600'

  // Warranty display
  const bhDays = item.ngay_het_bh ? diffDays(item.ngay_het_bh) : null

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
          <h1 className="text-base font-bold text-gray-800 truncate">{item.ten_kh || 'Công trình'}</h1>
          <p className="text-xs text-gray-400">{item.ma_ct}</p>
        </div>
        {successMsg && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* Status */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">TRẠNG THÁI</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700">
              {item.trang_thai || '—'}
            </span>
            <button onClick={() => setShowStatus(true)} disabled={updating}
              className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-xl">
              {updating ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </div>
        </div>

        {/* Timeline cards */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <p className="text-xs font-semibold text-gray-400">MỐC THỜI GIAN</p>

          {/* CS deadline */}
          <div className={`rounded-xl p-3 ${item.cs_overdue ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-100'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Chăm sóc khách hàng (60 ngày sau GH)</p>
                <p className={`text-base font-bold mt-0.5 ${csColor}`}>{fmtDate(item.ngay_can_cs)}</p>
              </div>
              <div className="text-right">
                {csDays !== null && (
                  <p className={`text-lg font-bold ${csColor}`}>
                    {item.cs_overdue ? `${Math.abs(csDays)}N` : `${csDays}N`}
                  </p>
                )}
                <p className="text-xs text-gray-400">{item.cs_overdue ? 'quá hạn' : 'còn lại'}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">GH kỹ thuật: {fmtDate(item.ngay_gh_thuc)}</p>
          </div>

          {/* Warranty */}
          <div className={`rounded-xl p-3 ${item.bh_expired ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-100'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Hết bảo hành (24 tháng sau NT)</p>
                <p className={`text-base font-bold mt-0.5 ${item.bh_expired ? 'text-red-600' : 'text-green-700'}`}>
                  {fmtDate(item.ngay_het_bh)}
                </p>
              </div>
              <div className="text-right">
                {bhDays !== null && (
                  <p className={`text-lg font-bold ${item.bh_expired ? 'text-red-600' : 'text-green-700'}`}>
                    {item.bh_expired ? `${Math.abs(bhDays)}N` : `${bhDays}N`}
                  </p>
                )}
                <p className="text-xs text-gray-400">{item.bh_expired ? 'đã hết hạn' : 'còn lại'}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Nghiệm thu: {fmtDate(item.ngay_nt)}</p>
          </div>
        </div>

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

        {/* Details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">CHI TIẾT CÔNG TRÌNH</p>
          <InfoRow label="Khách hàng" value={item.ten_kh} />
          <InfoRow label="Số điện thoại" value={item.sdt} />
          <InfoRow label="KTV phụ trách" value={item.ktv_phu_trach} />
          <InfoRow label="Sản phẩm" value={item.san_pham} />
          <InfoRow label="Địa chỉ" value={item.dia_chi} />
          <InfoRow label="GH kỹ thuật" value={fmtDate(item.ngay_gh_thuc)} />
          <InfoRow label="Nghiệm thu" value={fmtDate(item.ngay_nt)} />
          {item.ghi_chu && <InfoRow label="Ghi chú" value={item.ghi_chu} />}
        </div>
      </div>

      {/* Status picker bottom sheet */}
      {showStatus && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={e => e.target === e.currentTarget && setShowStatus(false)}>
          <div className="bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Cập nhật trạng thái</h2>
            </div>
            <div className="p-4 space-y-2 pb-8">
              {CONSTRUCTION_STATUSES.map(s => (
                <button key={s} onClick={() => updateStatus(s)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left ${
                    item.trang_thai === s ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}>
                  <span className="text-sm font-medium">{s}</span>
                  {item.trang_thai === s && <span className="text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
