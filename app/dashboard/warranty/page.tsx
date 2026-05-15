'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { WarrantyTicket } from '@/app/api/warranty-tickets/route'
import type { OrderWarranty } from '@/app/api/order-warranties/route'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysLabel(days: number) {
  if (days < 0)  return { text: `Hết hạn ${Math.abs(days)} ngày trước`, cls: 'text-red-500 font-semibold' }
  if (days === 0) return { text: 'Hết hạn hôm nay', cls: 'text-red-500 font-bold' }
  if (days <= 30) return { text: `Còn ${days} ngày`, cls: 'text-orange-500 font-semibold' }
  if (days <= 90) return { text: `Còn ${days} ngày`, cls: 'text-amber-500' }
  return { text: `Còn ${days} ngày`, cls: 'text-green-600' }
}

function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

// ─── Add Warranty Form ────────────────────────────────────────────────────────

function AddWarrantyForm({ onCreated, onClose }: {
  onCreated: (w: OrderWarranty) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({ order_id: '', bat_dau: '', het_han: '', loai_bh: '24 tháng', ghi_chu: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.bat_dau || !form.het_han) { setErr('Vui lòng điền ngày bắt đầu và kết thúc'); return }
    setSaving(true); setErr('')
    const res = await fetch('/api/order-warranties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: form.order_id ? parseInt(form.order_id) : undefined,
        bat_dau: form.bat_dau,
        het_han: form.het_han,
        loai_bh: form.loai_bh,
        ghi_chu: form.ghi_chu || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setErr(json.error ?? 'Lỗi server'); setSaving(false); return }
    onCreated(json.data)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-5 space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <p className="font-bold text-gray-800 text-base">Thêm thời hạn bảo hành</p>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">ID Đơn hàng (tuỳ chọn)</label>
            <input type="number" value={form.order_id} onChange={set('order_id')} placeholder="VD: 42"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Ngày bắt đầu *</label>
              <input type="date" value={form.bat_dau} onChange={set('bat_dau')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Ngày kết thúc *</label>
              <input type="date" value={form.het_han} onChange={set('het_han')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Loại bảo hành</label>
            <select value={form.loai_bh} onChange={set('loai_bh')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
              <option>12 tháng</option>
              <option>24 tháng</option>
              <option>36 tháng</option>
              <option>Trọn đời</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Ghi chú</label>
            <textarea value={form.ghi_chu} onChange={set('ghi_chu')} rows={2} placeholder="Phạm vi, điều kiện..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <button onClick={submit} disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
          {saving ? 'Đang lưu...' : 'Thêm bảo hành'}
        </button>
      </div>
    </div>
  )
}

// ─── Time filter helpers ──────────────────────────────────────────────────────

type TimePreset = 'month' | 'last_month' | 'quarter' | 'all' | 'custom'

function currentYM() {
  const d = new Date()
  return { y: d.getFullYear(), m: d.getMonth() + 1 }
}

function presetLabel(p: TimePreset, customY: number, customM: number) {
  if (p === 'all')        return 'Tất cả'
  if (p === 'month')      return 'Tháng này'
  if (p === 'last_month') return 'Tháng trước'
  if (p === 'quarter')    return 'Quý này'
  return `${String(customM).padStart(2,'0')}/${customY}`
}

function presetRange(p: TimePreset, customY: number, customM: number): [number,number] | null {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1
  if (p === 'all') return null
  if (p === 'month') return [new Date(y, m-1, 1).getTime(), new Date(y, m, 1).getTime()-1]
  if (p === 'last_month') {
    const lm = m===1?12:m-1, ly = m===1?y-1:y
    return [new Date(ly, lm-1, 1).getTime(), new Date(ly, lm, 1).getTime()-1]
  }
  if (p === 'quarter') {
    const q = Math.floor((m-1)/3)
    return [new Date(y, q*3, 1).getTime(), new Date(y, q*3+3, 1).getTime()-1]
  }
  return [new Date(customY, customM-1, 1).getTime(), new Date(customY, customM, 1).getTime()-1]
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WarrantyPage() {
  const router   = useRouter()

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'tickets' | 'periods'>('tickets')

  // ── Tickets state ─────────────────────────────────────────────────────────
  const [tickets,   setTickets]   = useState<WarrantyTicket[]>([])
  const [ticketLoad, setTicketLoad] = useState(true)
  const [filter,    setFilter]    = useState('Tất cả')

  // ── Periods state ──────────────────────────────────────────────────────────
  const [periods,    setPeriods]   = useState<OrderWarranty[]>([])
  const [periodLoad, setPeriodLoad] = useState(false)
  const [periodFilter, setPeriodFilter] = useState<'all' | 'active' | 'expired'>('all')
  const [showAddForm, setShowAddForm] = useState(false)

  // ── Time filter ───────────────────────────────────────────────────────────
  const { y: cY, m: cM } = currentYM()
  const [timePreset, setTimePreset] = useState<TimePreset>('all')
  const [customY,    setCustomY]    = useState(cY)
  const [customM,    setCustomM]    = useState(cM)
  const [showPicker, setShowPicker] = useState(false)

  // Reset time filter on tab change
  useEffect(() => { setTimePreset('all'); setShowPicker(false) }, [tab])

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [myRole,    setMyRole]    = useState('')
  const [myId,      setMyId]      = useState('')
  const [techList,  setTechList]  = useState<{ id: string; full_name: string }[]>([])
  const [assigning, setAssigning] = useState<number | null>(null)

  // ── Load tickets ──────────────────────────────────────────────────────────
  const loadTickets = useCallback(async () => {
    setTicketLoad(true)
    try {
      const statusParam = filter !== 'Tất cả' ? `&status=${encodeURIComponent(filter)}` : ''
      const res  = await fetch(`/api/warranty-tickets?all=true${statusParam}`)
      const json = await res.json()
      setTickets(json.data ?? [])
    } finally { setTicketLoad(false) }
  }, [filter])

  // ── Load periods ──────────────────────────────────────────────────────────
  const loadPeriods = useCallback(async () => {
    setPeriodLoad(true)
    try {
      const ef = periodFilter === 'active' ? '?expired=false' : periodFilter === 'expired' ? '?expired=true' : ''
      const res  = await fetch(`/api/order-warranties${ef}`)
      const json = await res.json()
      setPeriods(json.data ?? [])
    } finally { setPeriodLoad(false) }
  }, [periodFilter])

  useEffect(() => { loadTickets() }, [loadTickets])
  useEffect(() => { if (tab === 'periods') loadPeriods() }, [tab, loadPeriods])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { setMyRole(d?.role ?? ''); setMyId(d?.id ?? '') }).catch(() => {})
    fetch('/api/staff?role=tech').then(r => r.json()).then(d => setTechList(d.data ?? [])).catch(() => {})
  }, [])

  // ── Ticket helpers ────────────────────────────────────────────────────────
  const updateStatus = async (ticketId: number, trang_thai: string) => {
    const res = await fetch(`/api/warranty-tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trang_thai }),
    })
    if (res.ok) setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, trang_thai } : t))
  }

  const assignTech = async (ticketId: number, profileId: string) => {
    setAssigning(ticketId)
    const res = await fetch(`/api/warranty-tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nguoi_xu_ly: profileId }),
    })
    if (res.ok) {
      const name = techList.find(t => t.id === profileId)?.full_name ?? ''
      setTickets(prev => prev.map(t => t.id === ticketId
        ? { ...t, nguoi_xu_ly: profileId, nguoi_xu_ly_name: name } : t))
    }
    setAssigning(null)
  }

  // ── Derived: time-filtered lists ─────────────────────────────────────────
  const timeRange = presetRange(timePreset, customY, customM)

  const filteredTickets = tickets.filter(t => {
    if (filter !== 'Tất cả' && t.trang_thai !== filter) return false
    if (timeRange) {
      const ms = new Date(t.created_at).getTime()
      if (ms < timeRange[0] || ms > timeRange[1]) return false
    }
    return true
  })

  const filteredPeriods = periods.filter(p => {
    if (periodFilter === 'active'  && p.is_expired)  return false
    if (periodFilter === 'expired' && !p.is_expired) return false
    if (timeRange) {
      const ms = new Date(p.bat_dau).getTime()
      if (isNaN(ms)) return true
      if (ms < timeRange[0] || ms > timeRange[1]) return false
    }
    return true
  })

  const isManager    = ['admin', 'ceo', 'director'].includes(myRole)
  const isTechLead   = myRole === 'tech_lead'
  const canActTicket = (t: WarrantyTicket) => isManager || isTechLead || t.nguoi_xu_ly === myId

  const counts = STATUS_OPTIONS.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s] = tickets.filter(t => t.trang_thai === s).length
    return acc
  }, {})

  const periodCounts = {
    all:     periods.length,
    active:  periods.filter(p => !p.is_expired).length,
    expired: periods.filter(p => p.is_expired).length,
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 space-y-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Bảo hành</h1>
            <p className="text-xs text-gray-500">
              {tab === 'tickets' ? `${filteredTickets.length} phiếu` : `${filteredPeriods.length} hợp đồng BH`}
            </p>
          </div>
          <button
            onClick={() => tab === 'tickets' ? loadTickets() : loadPeriods()}
            className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
            Làm mới
          </button>
        </div>

        {/* Top-level tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('tickets')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
              tab === 'tickets' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            🛠️ Phiếu BH {tickets.length > 0 && <span className="ml-1 opacity-80">({filteredTickets.length})</span>}
          </button>
          <button onClick={() => setTab('periods')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
              tab === 'periods' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            🛡️ Thời hạn BH
          </button>
        </div>

        {/* Sub-filters */}
        {tab === 'tickets' && (
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
        )}

        {tab === 'periods' && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {([['all', 'Tất cả'], ['active', 'Còn hạn'], ['expired', 'Hết hạn']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setPeriodFilter(key)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  periodFilter === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {label}
                {periodCounts[key] > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${periodFilter === key ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {periodCounts[key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Time filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 shrink-0">Thời gian:</span>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
            {(['month', 'last_month', 'quarter', 'all'] as TimePreset[]).map(p => (
              <button key={p}
                onClick={() => { setTimePreset(p); setShowPicker(false) }}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  timePreset === p && p !== 'custom'
                    ? 'bg-blue-600 text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >{presetLabel(p, customY, customM)}</button>
            ))}
            <button onClick={() => setShowPicker(v => !v)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                timePreset === 'custom'
                  ? 'bg-blue-600 text-white border-transparent'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >{timePreset === 'custom' ? presetLabel('custom', customY, customM) : 'Tùy chọn'}</button>
          </div>
        </div>
        {showPicker && (
          <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2.5">
            <select value={customM} onChange={e => { setCustomM(Number(e.target.value)); setTimePreset('custom') }}
              className="text-sm bg-white border border-blue-200 rounded-lg px-2 py-1 outline-none">
              {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>Tháng {m}</option>)}
            </select>
            <select value={customY} onChange={e => { setCustomY(Number(e.target.value)); setTimePreset('custom') }}
              className="text-sm bg-white border border-blue-200 rounded-lg px-2 py-1 outline-none">
              {Array.from({length:5},(_,i)=>cY-2+i).map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => setShowPicker(false)} className="text-blue-600 text-sm font-semibold ml-auto">Xong</button>
          </div>
        )}
      </div>

      {/* ── Tab: Phiếu BH ──────────────────────────────────────────────────── */}
      {tab === 'tickets' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {ticketLoad && (
            <div className="flex items-center justify-center py-16">
              <span className="crm-spinner" />
            </div>
          )}

          {!ticketLoad && filteredTickets.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-3">
              <span className="text-4xl">🛡️</span>
              <p className="text-gray-500 text-sm font-medium">Không có phiếu nào</p>
            </div>
          )}

          {!ticketLoad && filteredTickets.map(t => (
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

              {/* Lịch hẹn */}
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
                  {t.scheduled_date && <span className="text-[10px] text-blue-400">→ đã đặt</span>}
                </div>
              )}
              {!canActTicket(t) && !isManager && t.scheduled_date && (
                <div className="flex items-center gap-2 mb-3 text-[10px] text-blue-500">
                  <span>📅</span>
                  <span>Lịch xử lý: {fmtDate(t.scheduled_date)}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
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
      )}

      {/* ── Tab: Thời hạn BH ───────────────────────────────────────────────── */}
      {tab === 'periods' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {periodLoad && (
            <div className="flex items-center justify-center py-16">
              <span className="crm-spinner" />
            </div>
          )}

          {!periodLoad && filteredPeriods.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-3">
              <span className="text-4xl">🛡️</span>
              <p className="text-gray-500 text-sm font-medium">Chưa có thời hạn bảo hành nào</p>
              {isManager && (
                <button onClick={() => setShowAddForm(true)}
                  className="text-xs text-blue-600 bg-blue-50 px-4 py-2 rounded-xl font-semibold">
                  + Thêm mới
                </button>
              )}
            </div>
          )}

          {/* Add button */}
          {!periodLoad && periods.length > 0 && isManager && (
            <button onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 border-2 border-dashed border-blue-200 text-blue-500 rounded-2xl text-xs font-semibold">
              + Thêm thời hạn bảo hành
            </button>
          )}

          {!periodLoad && filteredPeriods.map(w => {
            const { text: dText, cls: dCls } = daysLabel(w.days_left)
            return (
              <div key={w.id} className={`bg-white rounded-2xl shadow-sm border p-4 ${w.is_expired ? 'border-red-100' : 'border-gray-100'}`}>
                {/* Header */}
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    {w.ten_kh
                      ? <p className="text-sm font-semibold text-gray-800">{w.ten_kh}</p>
                      : <p className="text-sm font-semibold text-gray-400 italic">Khách hàng không rõ</p>
                    }
                    {w.ma_hd && (
                      <button
                        onClick={() => w.order_id && router.push(`/dashboard/contracts/b2c/${w.order_id}`)}
                        className="text-xs text-blue-600 hover:underline">
                        {w.ma_hd}
                      </button>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    w.is_expired ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                  }`}>
                    {w.is_expired ? 'Hết hạn' : 'Còn hạn'}
                  </span>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2">
                  <span>🛡️ {w.loai_bh}</span>
                  <span>·</span>
                  <span>{fmtDate(w.bat_dau)} → {fmtDate(w.het_han)}</span>
                </div>

                {/* Countdown */}
                <p className={`text-xs font-semibold ${dCls}`}>{dText}</p>

                {/* Progress bar */}
                {(() => {
                  const start = new Date(w.bat_dau).getTime()
                  const end   = new Date(w.het_han).getTime()
                  const now   = Date.now()
                  const pct   = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
                  return (
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${w.is_expired ? 'bg-red-400' : pct > 80 ? 'bg-orange-400' : 'bg-green-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )
                })()}

                {/* Note */}
                {w.ghi_chu && (
                  <p className="text-[10px] text-gray-400 mt-2">{w.ghi_chu}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Warranty Form */}
      {showAddForm && (
        <AddWarrantyForm
          onCreated={w => { setPeriods(prev => [w, ...prev]); setShowAddForm(false) }}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}
