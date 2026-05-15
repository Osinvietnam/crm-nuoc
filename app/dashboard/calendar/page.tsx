'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { CalendarEvent } from '@/app/api/calendar/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VI_WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const VI_MONTHS   = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                     'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']

// ─── Lịch âm (Vietnamese Lunar Calendar) ─────────────────────────────────────
// Thuật toán: Ho Ngoc Duc — UTC+7 (giờ Việt Nam)

const TZ = 7

function _jdFromDate(d: number, m: number, y: number): number {
  const a = Math.floor((14 - m) / 12)
  const yr = y + 4800 - a
  const mo = m + 12 * a - 3
  let jd = d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045
  if (jd < 2299161) jd = d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - 32083
  return jd
}

function _newMoonDay(k: number): number {
  const dr = Math.PI / 180
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T
  let Jde = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  Jde += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M   = 359.2242  + 29.10535608  * k - 0.0000333  * T2 - 0.00000347  * T3
  const Mpr = 306.0253  + 385.81691806 * k + 0.0107306  * T2 + 0.00001236  * T3
  const F   = 21.2964   + 390.67050646 * k - 0.0016528  * T2 - 0.00000239  * T3
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr) - 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  C1 -= 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
  C1 -= 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 += 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (M + 2 * Mpr))
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2
  return Math.floor(Jde + C1 - deltat + 0.5 + TZ / 24)
}

function _sunLong(jdn: number): number {
  const dr = Math.PI / 180
  const T = (jdn - 2451545.5 - TZ / 24) / 36525, T2 = T * T
  const M  = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  const DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
           + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M)
           + 0.00029 * Math.sin(dr * 3 * M)
  let L = (L0 + DL) / 360; L -= Math.floor(L)
  return Math.floor(L * 12)
}

function _lunarMonth11(y: number): number {
  const off = _jdFromDate(31, 12, y) - 2415021
  const k   = Math.floor(off / 29.530588853)
  let nm    = _newMoonDay(k)
  if (_sunLong(nm) >= 9) nm = _newMoonDay(k - 1)
  return nm
}

function _leapOffset(a11: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last = 0, i = 1
  let arc  = _sunLong(_newMoonDay(k + i))
  do { last = arc; i++; arc = _sunLong(_newMoonDay(k + i)) } while (arc !== last && i < 14)
  return i - 1
}

function solarToLunar(d: number, m: number, y: number): { day: number; month: number; year: number; leap: boolean } {
  const dayNum = _jdFromDate(d, m, y)
  const k      = Math.floor((dayNum - 2415021.076998695) / 29.530588853)
  let monthStart = _newMoonDay(k + 1)
  if (monthStart > dayNum) monthStart = _newMoonDay(k)
  let a11 = _lunarMonth11(y), b11 = a11
  if (a11 >= monthStart) { a11 = _lunarMonth11(y - 1) } else { b11 = _lunarMonth11(y + 1) }
  const lunarDay = dayNum - monthStart + 1
  const diff     = Math.floor((monthStart - a11) / 29)
  let lunarLeap  = false
  let lunarMonth = diff + 11
  if (b11 - a11 > 365) {
    const lo = _leapOffset(a11)
    if (diff >= lo) { lunarMonth = diff + 10; if (diff === lo) lunarLeap = true }
  }
  if (lunarMonth > 12) lunarMonth -= 12
  const lunarYear = (lunarMonth >= 11 && diff < 4) ? y - 1 : y
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap }
}

// Cache để tránh tính lại nhiều lần
const _lunarCache = new Map<string, { day: number; month: number; year: number; leap: boolean }>()
function getLunar(d: number, m: number, y: number) {
  const key = `${y}-${m}-${d}`
  if (!_lunarCache.has(key)) _lunarCache.set(key, solarToLunar(d, m, y))
  return _lunarCache.get(key)!
}

// Hiển thị ngày âm: nếu là mùng 1 thì show "T.X" (tháng âm), ngược lại show số ngày
function lunarLabel(d: number, m: number, y: number): string {
  const l = getLunar(d, m, y)
  if (l.day === 1) return `T.${l.month}${l.leap ? '*' : ''}`
  return String(l.day)
}

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
  // ── Báo giá ────────────────────────────────────────────
  quote:         'bg-blue-500',
  quote_expire:  'bg-red-500',
  quote_submit:  'bg-orange-400',
  // ── Hợp đồng / giao hàng ───────────────────────────────
  contract:      'bg-green-500',
  contract_sign: 'bg-emerald-500',
  delivery_tm:   'bg-green-400',
  // ── Bảo trì ────────────────────────────────────────────
  construction:  'bg-orange-500',
  acceptance:    'bg-yellow-500',
  periodic:      'bg-purple-500',
  // ── Bảo hành ───────────────────────────────────────────
  warranty:      'bg-red-400',
  // ── Dự án ──────────────────────────────────────────────
  project:       'bg-teal-500',
  project_sign:  'bg-teal-500',
  project_start: 'bg-cyan-500',
  project_end:   'bg-teal-600',
  // ── Tài vụ / Task ──────────────────────────────────────
  payment_due:   'bg-violet-500',
  task_due:      'bg-gray-600',
}

const TYPE_LABEL: Record<string, string> = {
  // ── Báo giá ────────────────────────────────────────────
  quote:         '📋 BG Follow-up',
  quote_expire:  '⚠️ BG hết hạn',
  quote_submit:  '📤 Nộp thầu',
  // ── Hợp đồng / giao hàng ───────────────────────────────
  contract:      '📦 Giao hàng B2C',
  contract_sign: '✍️ Ký hợp đồng',
  delivery_tm:   '📦 Giao hàng TM',
  // ── Bảo trì ────────────────────────────────────────────
  construction:  '🔧 Bảo trì CT',
  acceptance:    '✅ Nghiệm thu',
  periodic:      '🔄 Bảo dưỡng ĐK',
  // ── Bảo hành ───────────────────────────────────────────
  warranty:      '🛠️ Bảo hành',
  // ── Dự án ──────────────────────────────────────────────
  project:       '🏗️ Dự án',
  project_sign:  '🏗️ DK ký HĐ DA',
  project_start: '🏗️ Khởi công',
  project_end:   '🏁 Hoàn thành DA',
  // ── Tài vụ / Task ──────────────────────────────────────
  payment_due:   '💰 Đến hạn TT',
  task_due:      '📋 Task deadline',
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
                    <span className={`text-[9px] leading-none mb-0.5 ${
                      isSelected
                        ? 'text-blue-100'
                        : isToday
                        ? 'text-blue-400'
                        : isCurrentMonth
                        ? 'text-gray-400'
                        : 'text-gray-200'
                    }`}>
                      {lunarLabel(cell.day, cell.month, cell.year)}
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
