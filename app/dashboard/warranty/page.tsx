'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { WarrantyTicket } from '@/app/api/warranty-tickets/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Tất cả', 'Chờ xử lý', 'Đang xử lý', 'Hoàn thành', 'Đóng']

const STATUS_COLOR: Record<string, string> = {
  'Chờ xử lý':  'bg-amber-100 text-amber-700',
  'Đang xử lý': 'bg-blue-100 text-blue-700',
  'Hoàn thành': 'bg-green-100 text-green-700',
  'Đóng':       'bg-gray-100 text-gray-600',
}

const PRIORITY_COLOR: Record<string, string> = {
  'Khẩn cấp':   'text-red-600 font-bold',
  'Cao':         'text-orange-500 font-semibold',
  'Bình thường': 'text-gray-500',
  'Thấp':        'text-gray-400',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WarrantyPage() {
  const router   = useRouter()
  const [tickets,  setTickets]   = useState<WarrantyTicket[]>([])
  const [loading,  setLoading]   = useState(true)
  const [filter,   setFilter]    = useState('Tất cả')
  const [myRole,   setMyRole]    = useState('')
  const [myId,     setMyId]      = useState('')
  const [techList, setTechList]  = useState<{ id: string; full_name: string }[]>([])
  const [assigning, setAssigning] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const statusParam = filter !== 'Tất cả' ? `&status=${encodeURIComponent(filter)}` : ''
      const res  = await fetch(`/api/warranty-tickets?all=true${statusParam}`)
      const json = await res.json()
      setTickets(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { setMyRole(d?.role ?? ''); setMyId(d?.id ?? '') }).catch(() => {})
    fetch('/api/staff?role=tech').then(r => r.json()).then(d => setTechList(d.data ?? [])).catch(() => {})
  }, [])

  const updateStatus = async (ticketId: number, trang_thai: string) => {
    const res  = await fetch(`/api/warranty-tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trang_thai }),
    })
    if (res.ok) {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, trang_thai } : t))
    }
  }

  const assignTech = async (ticketId: number, profileId: string) => {
    setAssigning(ticketId)
    const res = await fetch(`/api/warranty-tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nguoi_xu_ly: profileId }),
    })
    if (res.ok) {
      const json = await res.json()
      const name = techList.find(t => t.id === profileId)?.full_name ?? ''
      setTickets(prev => prev.map(t => t.id === ticketId
        ? { ...t, nguoi_xu_ly: profileId, nguoi_xu_ly_name: name }
        : t
      ))
    }
    setAssigning(null)
  }

  const isManager    = ['admin', 'ceo', 'director'].includes(myRole)
  const isTechLead   = myRole === 'tech_lead'
  // tech chỉ thao tác ticket được giao cho mình; tech_lead/manager thao tác tất cả
  const canActTicket = (t: WarrantyTicket) =>
    isManager || isTechLead || t.nguoi_xu_ly === myId
  const counts    = STATUS_OPTIONS.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s] = tickets.filter(t => t.trang_thai === s).length
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 space-y-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Bảo hành</h1>
            <p className="text-xs text-gray-500">{tickets.length} yêu cầu</p>
          </div>
          <button onClick={load} className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
            Làm mới
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {STATUS_OPTIONS.map(s => {
            const cnt = s === 'Tất cả' ? tickets.length : (counts[s] ?? 0)
            return (
              <button key={s} onClick={() => setFilter(s)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {s}
                {cnt > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${filter === s ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {cnt}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="crm-spinner" />
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <span className="text-4xl">🛡️</span>
            <p className="text-gray-500 text-sm font-medium">Không có yêu cầu nào</p>
          </div>
        )}

        {!loading && tickets.map(t => (
          <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            {/* Header row */}
            <div className="flex items-start gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{t.title}</p>
                {t.khach_hang && (
                  <button
                    onClick={() => t.order_id && router.push(`/dashboard/contracts/b2c/${t.order_id}`)}
                    className="text-xs text-blue-600 hover:underline text-left">
                    {t.khach_hang}{t.ma_hd ? ` · ${t.ma_hd}` : ''}
                  </button>
                )}
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[t.trang_thai] ?? 'bg-gray-100 text-gray-600'}`}>
                {t.trang_thai}
              </span>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 text-[10px] flex-wrap mb-3">
              <span className={PRIORITY_COLOR[t.priority] ?? ''}>🔺 {t.priority}</span>
              {t.nguoi_xu_ly_name
                ? <span className="text-blue-500">🔧 {t.nguoi_xu_ly_name}</span>
                : <span className="text-gray-400">Chưa phân công</span>
              }
              {t.mo_ta && <span className="text-gray-400 truncate max-w-[200px]">{t.mo_ta}</span>}
              <span className="text-gray-400 ml-auto">{new Date(t.created_at).toLocaleDateString('vi-VN')}</span>
            </div>

            {/* Lịch hẹn (scheduled_date) — KTV và Manager được lên lịch */}
            {(canActTicket(t) || isManager) && !['Hoàn thành', 'Đóng'].includes(t.trang_thai) && (
              <div className="flex items-center gap-2 mb-3 bg-blue-50 rounded-xl px-3 py-2">
                <span className="text-[10px] text-blue-500 font-semibold flex-shrink-0">📅 Lịch xử lý</span>
                <input
                  type="date"
                  defaultValue={t.scheduled_date ?? ''}
                  onChange={async e => {
                    const val = e.target.value || null
                    await fetch(`/api/warranty-tickets/${t.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ scheduled_date: val }),
                    })
                    setTickets(prev => prev.map(x => x.id === t.id ? { ...x, scheduled_date: val } : x))
                  }}
                  className="text-xs border-none bg-transparent text-blue-700 font-medium focus:outline-none flex-1"
                />
                {t.scheduled_date && (
                  <span className="text-[10px] text-blue-400">→ lịch đã đặt</span>
                )}
              </div>
            )}
            {/* Hiển thị lịch (read-only) nếu không có quyền sửa */}
            {!canActTicket(t) && !isManager && t.scheduled_date && (
              <div className="flex items-center gap-2 mb-3 text-[10px] text-blue-500">
                <span>📅</span>
                <span>Lịch xử lý: {new Date(t.scheduled_date).toLocaleDateString('vi-VN')}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status transitions — tech chỉ thao tác ticket được giao */}
              {t.trang_thai === 'Chờ xử lý' && canActTicket(t) && (
                <button onClick={() => updateStatus(t.id, 'Đang xử lý')}
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl font-semibold">
                  Bắt đầu xử lý
                </button>
              )}
              {t.trang_thai === 'Đang xử lý' && canActTicket(t) && (
                <button onClick={() => updateStatus(t.id, 'Hoàn thành')}
                  className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-xl font-semibold">
                  Hoàn thành
                </button>
              )}
              {(t.trang_thai === 'Hoàn thành' || t.trang_thai === 'Đang xử lý') && isManager && (
                <button onClick={() => updateStatus(t.id, 'Đóng')}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl">
                  Đóng ticket
                </button>
              )}

              {/* Assign tech (manager only) */}
              {isManager && techList.length > 0 && (
                <select
                  value={t.nguoi_xu_ly ?? ''}
                  onChange={e => assignTech(t.id, e.target.value)}
                  disabled={assigning === t.id}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-xl bg-white text-gray-600 ml-auto">
                  <option value="">— Giao KTV —</option>
                  {techList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
