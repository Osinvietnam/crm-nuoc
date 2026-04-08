'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PROJECT_STAGE_COLORS } from '@/lib/lark/tables'
import type { Project } from '@/app/api/lark/orders/route'

const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '—'
const fmtDate  = (ms: number | null) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === 'undefined' || value === 'null' || value === '—') return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  )
}

const PROJECT_STAGES = [
  'Tìm hiểu',
  'Báo giá',
  'Đang thương thảo',
  'Đã ký HĐ',
  'Đang thi công',
  'Hoàn thành',
  'Thua thầu',
  'Tạm dừng',
]

export default function ProjectDetailPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showStage, setShowStage] = useState(false)
  const [updating, setUpdating]   = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    fetch(`/api/lark/orders/project/${id}`)
      .then(r => r.json())
      .then(d => setProject(d.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const updateStage = async (stage: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/lark/orders/project/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giai_doan: stage }),
      })
      if (!res.ok) throw new Error()
      setProject(prev => prev ? { ...prev, giai_doan: stage } : prev)
      setSuccessMsg('Đã cập nhật')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch {} finally { setUpdating(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><span className="crm-spinner" /></div>
  if (!project) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 text-sm">Không tìm thấy dự án</p>
      <button onClick={() => router.back()} className="text-blue-600 text-sm font-semibold">← Quay lại</button>
    </div>
  )

  const sc = PROJECT_STAGE_COLORS[project.giai_doan] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800 truncate">{project.ten_da}</h1>
          <p className="text-xs text-gray-400">{project.ma_da}</p>
        </div>
        {successMsg && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* Stage */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">GIAI ĐOẠN DỰ ÁN</p>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-xl ${sc.bg} ${sc.text}`}>
              {project.giai_doan || '—'}
            </span>
            <button onClick={() => setShowStage(true)} disabled={updating}
              className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-xl">
              {updating ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </div>
        </div>

        {/* Financial overview */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">GIÁ TRỊ DỰ ÁN</p>
          <div className="space-y-3">
            {project.gia_tri_dt > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Dự toán</span>
                <span className="text-base font-bold text-blue-600">{fmtMoney(project.gia_tri_dt)}</span>
              </div>
            )}
            {project.gia_tri_hd > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Giá trị HĐ ký</span>
                <span className="text-base font-bold text-green-600">{fmtMoney(project.gia_tri_hd)}</span>
              </div>
            )}
            {project.cong_no > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Công nợ còn lại</span>
                <span className="text-base font-bold text-red-500">{fmtMoney(project.cong_no)}</span>
              </div>
            )}
            {project.ty_le_thang > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-500">Tỷ lệ thắng thầu</span>
                  <span className="text-sm font-bold text-green-600">{project.ty_le_thang}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${project.ty_le_thang}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">TIẾN ĐỘ THỜI GIAN</p>
          <InfoRow label="Ngày báo giá" value={fmtDate(project.ngay_bao_gia)} />
          <InfoRow label="DK ký HĐ" value={fmtDate(project.ngay_du_kien_ky)} />
          <InfoRow label="Bắt đầu TC" value={fmtDate(project.ngay_bt_tc)} />
          <InfoRow label="Hoàn thành DK" value={fmtDate(project.ngay_hoan_thanh)} />
        </div>

        {/* Details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">THÔNG TIN DỰ ÁN</p>
          <InfoRow label="Chủ đầu tư" value={project.chu_dau_tu} />
          <InfoRow label="Tổng thầu / Mời" value={project.tong_thau} />
          <InfoRow label="Loại dự án" value={project.loai_da} />
          <InfoRow label="Quy mô" value={project.quy_mo} />
          <InfoRow label="Tỉnh / Thành" value={project.tinh_thanh} />
          <InfoRow label="Đối tác tham gia" value={project.doi_tac} />
          <InfoRow label="NV phụ trách" value={project.nv_phu_trach} />
          {project.ghi_chu && <InfoRow label="Ghi chú" value={project.ghi_chu} />}
        </div>
      </div>

      {showStage && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={e => e.target === e.currentTarget && setShowStage(false)}>
          <div className="bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Cập nhật giai đoạn</h2>
            </div>
            <div className="p-4 space-y-2 pb-8">
              {PROJECT_STAGES.map(s => {
                const c = PROJECT_STAGE_COLORS[s] ?? { bg: 'bg-gray-50', text: 'text-gray-600' }
                return (
                  <button key={s} onClick={() => { updateStage(s); setShowStage(false) }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left ${
                      project.giai_doan === s ? `${c.bg} ${c.text}` : 'hover:bg-gray-50 text-gray-700'
                    }`}>
                    <span className="text-sm font-medium">{s}</span>
                    {project.giai_doan === s && <span className="text-xs">✓</span>}
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
