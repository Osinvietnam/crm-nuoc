'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePullToRefresh, PullIndicator } from '@/components/PullToRefresh'
import type { Construction, PeriodicService } from '@/app/api/lark/maintenance/_mappers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (ms: number | null) => {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diffDays(target: number): number {
  return Math.ceil((target - Date.now()) / 86400000)
}

// ─── Urgency helpers ──────────────────────────────────────────────────────────

function csUrgency(c: Construction): { label: string; bg: string; text: string } {
  if (!c.ngay_can_cs) return { label: 'Chưa GH', bg: 'bg-gray-100', text: 'text-gray-500' }
  if (c.cs_overdue)   return { label: 'Quá hạn CS', bg: 'bg-red-100', text: 'text-red-600' }
  const days = diffDays(c.ngay_can_cs)
  if (days <= 7)  return { label: `CS: ${days}N`, bg: 'bg-orange-100', text: 'text-orange-600' }
  if (days <= 14) return { label: `CS: ${days}N`, bg: 'bg-yellow-100', text: 'text-yellow-600' }
  return { label: `CS: ${days}N`, bg: 'bg-green-100', text: 'text-green-600' }
}

function periodicUrgency(p: PeriodicService): { label: string; bg: string; text: string } {
  const d = p.so_ngay_con_lai
  if (d < 0)   return { label: 'Quá hạn', bg: 'bg-red-100', text: 'text-red-600' }
  if (d <= 7)  return { label: `${d} ngày`, bg: 'bg-orange-100', text: 'text-orange-600' }
  if (d <= 30) return { label: `${d} ngày`, bg: 'bg-yellow-100', text: 'text-yellow-600' }
  return { label: `${d} ngày`, bg: 'bg-green-100', text: 'text-green-600' }
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function ConstructionCard({ c, onClick }: { c: Construction; onClick: () => void }) {
  const urg = csUrgency(c)
  return (
    <button onClick={onClick} className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{c.ten_kh || '(Chưa có tên)'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{c.ma_ct} · {c.ktv_phu_trach || 'Chưa phân công'}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${urg.bg} ${urg.text}`}>
          {urg.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <p className="text-xs text-gray-500">GH kỹ thuật</p>
          <p className="text-xs font-medium text-gray-700">{fmtDate(c.ngay_gh_thuc)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Cần CS trước</p>
          <p className={`text-xs font-medium ${c.cs_overdue ? 'text-red-600' : 'text-gray-700'}`}>
            {fmtDate(c.ngay_can_cs)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Nghiệm thu</p>
          <p className="text-xs font-medium text-gray-700">{fmtDate(c.ngay_nt)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Hết bảo hành</p>
          <p className={`text-xs font-medium ${c.bh_expired ? 'text-red-500' : 'text-gray-700'}`}>
            {fmtDate(c.ngay_het_bh)}{c.bh_expired ? ' ⚠️' : ''}
          </p>
        </div>
      </div>

      {c.san_pham && (
        <p className="text-xs text-gray-500 mt-2 truncate">📦 {c.san_pham}</p>
      )}
    </button>
  )
}

function PeriodicCard({ p, onClick }: { p: PeriodicService; onClick: () => void }) {
  const urg = periodicUrgency(p)
  return (
    <button onClick={onClick} className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left active:scale-[0.98] transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{p.ten_kh || '(Chưa có tên)'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{p.ma_bddk} · {p.nv_phu_trach || 'Chưa phân công'}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${urg.bg} ${urg.text}`}>
          {urg.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <p className="text-xs text-gray-500">BĐ gần nhất</p>
          <p className="text-xs font-medium text-gray-700">{fmtDate(p.lan_bd_gan_nhat)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">BĐ tiếp theo</p>
          <p className={`text-xs font-medium ${p.so_ngay_con_lai < 0 ? 'text-red-600' : 'text-gray-700'}`}>
            {fmtDate(p.lan_bd_tiep_theo)}
          </p>
        </div>
      </div>

      {p.san_pham_da_lap.length > 0 && (
        <p className="text-xs text-gray-500 mt-2 truncate">📦 {p.san_pham_da_lap.join(', ')}</p>
      )}

      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-gray-500">Chu kỳ: {p.chu_ky} tháng</span>
        {p.sdt && (
          <a
            href={`tel:${p.sdt}`}
            onClick={e => e.stopPropagation()}
            className="ml-auto text-xs bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full"
          >
            📞 Gọi
          </a>
        )}
      </div>
    </button>
  )
}

// ─── Data hook ────────────────────────────────────────────────────────────────

type Tab = 'construction' | 'periodic'
type FilterOption = 'all' | 'urgent' | 'overdue'

function useMaintenanceData(tab: Tab) {
  const [data, setData]       = useState<(Construction | PeriodicService)[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/lark/maintenance?tab=${tab}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data ?? [])
    } catch {
      setError('Không tải được dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const router = useRouter()
  const [tab, setTab]       = useState<Tab>('construction')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterOption>('all')

  const { data, loading, error, reload } = useMaintenanceData(tab)

  const ptr = usePullToRefresh(async () => { reload() })

  const countFilter = (f: FilterOption) => data.filter(item => {
    if (tab === 'construction') {
      const c = item as Construction
      if (f === 'overdue') return c.cs_overdue
      if (f === 'urgent')  return !c.cs_overdue && c.ngay_can_cs !== null && diffDays(c.ngay_can_cs) <= 14
    } else {
      const p = item as PeriodicService
      if (f === 'overdue') return p.so_ngay_con_lai < 0
      if (f === 'urgent')  return p.so_ngay_con_lai >= 0 && p.so_ngay_con_lai <= 30
    }
    return true
  }).length

  const filtered = data.filter(item => {
    const q = search.toLowerCase()
    if (q) {
      const str = JSON.stringify(item).toLowerCase()
      if (!str.includes(q)) return false
    }
    if (tab === 'construction') {
      const c = item as Construction
      if (filter === 'overdue') return c.cs_overdue
      if (filter === 'urgent')  return !c.cs_overdue && c.ngay_can_cs !== null && diffDays(c.ngay_can_cs) <= 14
    } else {
      const p = item as PeriodicService
      if (filter === 'overdue') return p.so_ngay_con_lai < 0
      if (filter === 'urgent')  return p.so_ngay_con_lai >= 0 && p.so_ngay_con_lai <= 30
    }
    return true
  })

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'construction', label: 'Công trình', icon: '🔧' },
    { key: 'periodic',     label: 'Định kỳ',    icon: '🔄' },
  ]

  const filterOptions: { key: FilterOption; label: string }[] = [
    { key: 'all',     label: 'Tất cả' },
    { key: 'urgent',  label: 'Sắp tới' },
    { key: 'overdue', label: 'Quá hạn' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Bảo trì</h1>
            <p className="text-xs text-gray-500">
              {loading ? 'Đang tải...' : `${data.length} mục`}
            </p>
          </div>
          <button
            onClick={reload}
            className="text-sm text-blue-600 font-medium px-3 py-1.5 rounded-xl bg-blue-50"
          >
            ↻ Tải lại
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setFilter('all') }}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="search"
            placeholder="Tìm khách hàng, mã..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {filterOptions.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}
              {f.key !== 'all' && (
                <span className="ml-1 opacity-75">({countFilter(f.key)})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div
        className="flex-1 overflow-y-auto bg-gray-50"
        onTouchStart={ptr.onTouchStart}
        onTouchMove={ptr.onTouchMove}
        onTouchEnd={ptr.onTouchEnd}
      >
        <PullIndicator dist={ptr.dist} refreshing={ptr.refreshing} />
        <div className="p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
            <span className="crm-spinner" /><span>Đang tải...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center py-16 gap-3">
            <p className="text-gray-400 text-sm">{error}</p>
            <button onClick={reload} className="text-blue-600 text-sm font-medium">Thử lại</button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-2">
            <span className="text-4xl">✅</span>
            <p className="text-gray-500 text-sm font-medium">Không có mục nào</p>
            <p className="text-gray-400 text-xs">Thay đổi bộ lọc hoặc tìm kiếm</p>
          </div>
        )}

        {!loading && !error && filtered.map(item => (
          tab === 'construction'
            ? <ConstructionCard
                key={item.record_id}
                c={item as Construction}
                onClick={() => router.push(`/dashboard/maintenance/construction/${item.record_id}`)}
              />
            : <PeriodicCard
                key={item.record_id}
                p={item as PeriodicService}
                onClick={() => router.push(`/dashboard/maintenance/periodic/${item.record_id}`)}
              />
        ))}
        </div>
      </div>
    </div>
  )
}
