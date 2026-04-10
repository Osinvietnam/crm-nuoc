export const dynamic = 'force-dynamic'
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { CalendarEvent } from '@/app/api/calendar/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VI_WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const VI_MONTHS   = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                     'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function startOfDay(ms: number) {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// Build calendar grid for a given year/month
// Returns weeks (array of 7-cell rows), each cell is {day, isCurrentMonth, dateKey}
function buildGrid(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1)
  // Monday = 0, ... Sunday = 6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrev  = new Date(year, month - 1, 0).getDate()

  const cells: { day: number; month: number; year: number; key: string }[] = []

  // Prev month fill
  for (let i = startDow - 1; i >= 0; i--) {
    const d = daysInPrev - i
    const m = month === 1 ? 12 : month - 1
    const y = month === 1 ? year - 1 : year
    cells.push({ day: d, month: m, year: y, key: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, key: `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}` })
  }

  // Next month fill
  const remainder = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= remainder; d++) {
    const m = month === 12 ? 1 : month + 1
    const y = month === 12 ? year + 1 : year
    cells.push({ day: d, month: m, year: y, key: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` })
  }

  // Split into weeks
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

// ─── Event dot ────────────────────────────────────────────────────────────────

const TYPE_DOT: Record<string, string> = {
  quote:        'bg-blue-500',
  construction: 'bg-orange-500',
  periodic:     'bg-purple-500',
  contract:     'bg-green-500',
  project:      'bg-teal-500',
}

const TYPE_LABEL: Record<string, string> = {
  quote:        '📋 Báo giá',
  construction: '🔧 Bảo trì CT',
  periodic:     '🔄 Bảo dưỡng',
  contract:     '📦 Giao hàng',
  project:      '🏗️ Dự án',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const today  = new Date()

  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [events,   setEvents]   = useState<CalendarEvent[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selectedKey, setSelectedKey] = useState<string>(ymd(today))

  const monthKey = `${year}-${String(month).padStart(2,'0')}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar?month=${monthKey}`)
      const d   = await res.json()
      setEvents(d.events ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [monthKey])

  useEffect(() => { load() }, [load])

  // Map dateKey → events[]
  const eventMap = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      const k = ymd(new Date(e.date))
      if (!m[k]) m[k] = []
      m[k].push(e)
    }
    return m
  }, [events])

  const weeks = useMemo(() => buildGrid(year, month), [year, month])

  const selectedEvents = eventMap[selectedKey] ?? []
  const todayKey = ymd(today)

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <button onClick={prevMonth} className="p-2.5 rounded-xl text-gray-500 active:bg-gray-100 text-lg leading-none">‹</button>
          <div className="text-center">
            <p className="text-base font-bold text-gray-800">{VI_MONTHS[month-1]} {year}</p>
            <p className="text-xs text-gray-400">{events.length} sự kiện</p>
          </div>
          <button onClick={nextMonth} className="p-2.5 rounded-xl text-gray-500 active:bg-gray-100 text-lg leading-none">›</button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mt-2">
          {VI_WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold pb-1 ${i === 6 ? 'text-red-400' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="space-y-0.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((cell, ci) => {
                const isCurrentMonth = cell.month === month
                const isToday        = cell.key === todayKey
                const isSelected     = cell.key === selectedKey
                const cellEvents     = eventMap[cell.key] ?? []
                const dotTypes       = [...new Set(cellEvents.map(e => e.type))].slice(0, 3)

                return (
                  <button
                    key={cell.key}
                    onClick={() => setSelectedKey(cell.key)}
                    className={`flex flex-col items-center py-1 rounded-xl transition-colors ${
                      isSelected ? 'bg-blue-600' : isToday ? 'bg-blue-50' : 'active:bg-gray-100'
                    }`}
                  >
                    <span className={`text-sm font-semibold leading-6 w-7 h-7 flex items-center justify-center rounded-full ${
                      isSelected
                        ? 'text-white'
                        : isToday
                        ? 'text-blue-600'
                        : isCurrentMonth
                        ? ci === 6 ? 'text-red-400' : 'text-gray-700'
                        : 'text-gray-300'
                    }`}>
                      {cell.day}
                    </span>
                    <div className="flex gap-0.5 h-2 items-center">
                      {dotTypes.map(t => (
                        <span key={t} className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[t]} ${isSelected ? 'opacity-90' : ''}`} />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected day events */}
      <div className="flex-1 overflow-y-auto">
        {/* Day label */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-700">
            {(() => {
              const [sy, sm, sd] = selectedKey.split('-').map(Number)
              const d = new Date(sy, sm - 1, sd)
              const dow = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'][d.getDay()]
              return `${dow}, ${sd}/${sm}/${sy}`
            })()}
          </p>
          {loading && <span className="crm-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
        </div>

        {selectedEvents.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2 text-center">
            <span className="text-4xl">📅</span>
            <p className="text-sm font-medium text-gray-500">Không có sự kiện</p>
            <p className="text-xs text-gray-400">Ngày này chưa có lịch hẹn hoặc bảo trì</p>
          </div>
        ) : (
          <div className="px-4 space-y-2 pb-6">
            {selectedEvents.map(e => (
              <button
                key={e.id}
                onClick={() => router.push(e.href)}
                className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left flex items-start gap-3 active:scale-[0.98] transition-transform"
              >
                <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${e.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{e.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABEL[e.type]} · {e.sub}</p>
                </div>
                <span className="text-gray-300 text-lg leading-none mt-0.5">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
