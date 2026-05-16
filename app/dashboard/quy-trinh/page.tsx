'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineCfg {
  order_type: string
  display_name: string
  stages: string[]
  stage_labels: string[]
  is_active: boolean
  description: string | null
}

interface FunnelStage {
  stage: string
  count: number
  entered_period: number
  conversion_pct: number | null
  next_stage: string | null
}

interface VelocityStage {
  stage: string
  avg_days: number | null
  median_days: number | null
  p90_days: number | null
  sample_count: number
  sla_days: number
  status: 'ok' | 'warning' | 'critical' | 'no_data'
}

interface StaleCustomer {
  id: number
  ho_ten: string
  pipeline: string
  days_stuck: number
  sla_days: number
  over_sla_days: number
  nguoi_phu_trach_name: string | null
  sla_status: 'ok' | 'warning' | 'critical'
}

interface OverviewStage {
  label: string
  code: string
  count: number
  sla_days: number
  avg_days: number
  sla_status: 'ok' | 'warning' | 'critical' | 'empty'
}

interface OverviewPipeline {
  order_type: string
  is_active: boolean
  stages: OverviewStage[]
}

interface GridCell {
  count: number
  sla_status: string
  in_pipeline: boolean
}

interface GridRow {
  stage: string
  row: Record<string, GridCell>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_TYPE_COLOR: Record<string, string> = {
  B2C:        'bg-blue-100 text-blue-700',
  Thuong_mai: 'bg-green-100 text-green-700',
  Du_an:      'bg-purple-100 text-purple-700',
}
const ORDER_TYPE_BORDER: Record<string, string> = {
  B2C:        'border-blue-200',
  Thuong_mai: 'border-green-200',
  Du_an:      'border-purple-200',
}
const ORDER_TYPE_NODE: Record<string, string> = {
  B2C:        'bg-blue-50  border-blue-200  text-blue-800',
  Thuong_mai: 'bg-green-50 border-green-200 text-green-800',
  Du_an:      'bg-purple-50 border-purple-200 text-purple-800',
}
const ORDER_TYPE_ICON: Record<string, string> = {
  B2C:        '🏠',
  Thuong_mai: '🏢',
  Du_an:      '🏗️',
}
const SLA_DOT: Record<string, string> = {
  ok:       'bg-green-400',
  warning:  'bg-amber-400',
  critical: 'bg-red-500',
  empty:    'bg-gray-200',
}
const SLA_BADGE: Record<string, string> = {
  ok:       'text-green-600',
  warning:  'text-amber-600',
  critical: 'text-red-600 font-bold',
  empty:    'text-gray-300',
}
const SLA_STATUS_COLOR = {
  ok:       'text-green-600 bg-green-50',
  warning:  'text-amber-600 bg-amber-50',
  critical: 'text-red-600 bg-red-50',
  no_data:  'text-gray-400 bg-gray-50',
}

// ─── Option A: Flow Nodes Component ──────────────────────────────────────────

function FlowNodes({ pipeline, color, nodeClass, borderClass }: {
  pipeline: OverviewPipeline
  color: string
  nodeClass: string
  borderClass: string
}) {
  const { stages } = pipeline

  return (
    <div className="overflow-x-auto pb-2 -mx-1 px-1">
      <div className="flex items-stretch gap-0 min-w-max">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-0">
            {/* Stage node */}
            <div className={`flex flex-col items-center border rounded-xl px-3 py-2.5 min-w-[84px] relative ${nodeClass} ${
              stage.sla_status === 'critical' ? 'ring-2 ring-red-300' :
              stage.sla_status === 'warning'  ? 'ring-1 ring-amber-200' : ''
            }`}>
              {/* SLA dot */}
              <span className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${SLA_DOT[stage.sla_status]}`} />

              {/* Count badge */}
              <span className={`text-lg font-extrabold leading-none mb-1 ${
                stage.count === 0 ? 'text-gray-300' : 'text-gray-800'
              }`}>
                {stage.count}
              </span>

              {/* Stage name */}
              <span className="text-[10px] font-semibold text-center leading-tight mb-1.5 max-w-[72px]">
                {stage.label}
              </span>

              {/* Avg days / SLA */}
              {stage.count > 0 ? (
                <span className={`text-[10px] leading-none ${SLA_BADGE[stage.sla_status]}`}>
                  {stage.avg_days > 0
                    ? `avg ${stage.avg_days}d`
                    : `SLA ${stage.sla_days}d`
                  }
                </span>
              ) : (
                <span className="text-[10px] text-gray-300">—</span>
              )}
            </div>

            {/* Arrow between nodes */}
            {i < stages.length - 1 && (
              <div className="flex flex-col items-center mx-1 flex-shrink-0">
                <div className="w-6 h-px bg-gray-200" />
                <span className="text-gray-300 text-[10px] -mt-0.5">▶</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Trong SLA</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Sắp quá</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Quá SLA</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block"/>Không có KH</span>
      </div>
    </div>
  )
}

// ─── Option C: Comparison Grid Component ─────────────────────────────────────

function ComparisonGrid({ grid, stageOrder, orderTypes }: {
  grid: GridRow[]
  stageOrder: string[]
  orderTypes: string[]
}) {
  const SLA_CELL: Record<string, string> = {
    ok:       'text-green-700 bg-green-50',
    warning:  'text-amber-700 bg-amber-50',
    critical: 'text-red-700   bg-red-50   font-bold',
    empty:    'text-gray-400  bg-transparent',
    na:       '',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[260px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 pr-3 text-gray-400 font-medium text-[10px] w-28">Stage</th>
            {orderTypes.map(ot => (
              <th key={ot} className="py-2 px-2 text-center font-semibold text-[10px]">
                <span className={`px-1.5 py-0.5 rounded-full ${ORDER_TYPE_COLOR[ot] ?? 'bg-gray-100 text-gray-600'}`}>
                  {ORDER_TYPE_ICON[ot] ?? '🔀'} {ot === 'Thuong_mai' ? 'TM' : ot}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stageOrder.filter(s => s !== 'Lost').map(stage => {
            const rowData = grid.find(g => g.stage === stage)
            if (!rowData) return null
            const totalCount = orderTypes.reduce((s, ot) => s + (rowData.row[ot]?.count ?? 0), 0)
            if (totalCount === 0 && !orderTypes.some(ot => rowData.row[ot]?.in_pipeline)) return null

            return (
              <tr key={stage} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className="py-2 pr-3 text-gray-600 font-medium truncate max-w-[112px]">{stage}</td>
                {orderTypes.map(ot => {
                  const cell = rowData.row[ot]
                  if (!cell || !cell.in_pipeline) {
                    return <td key={ot} className="py-2 px-2 text-center text-gray-200 text-[10px]">—</td>
                  }
                  return (
                    <td key={ot} className="py-2 px-2 text-center">
                      <span className={`inline-flex items-center justify-center w-10 h-6 rounded-lg text-xs font-semibold ${SLA_CELL[cell.sla_status] ?? ''}`}>
                        {cell.count}
                        {cell.sla_status === 'critical' && <span className="ml-0.5 text-[9px]">!</span>}
                        {cell.sla_status === 'warning'  && <span className="ml-0.5 text-[9px]">~</span>}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuyTrinhPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [authChecked, setAuthChecked] = useState(false)
  const [activeTab, setActiveTab]     = useState<'config' | 'analytics' | 'stale'>('config')

  // Config tab
  const [configs,     setConfigs]     = useState<PipelineCfg[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState<string | null>(null)
  const [success,     setSuccess]     = useState('')
  const [error,       setError]       = useState('')
  const [editLabels,  setEditLabels]  = useState<Record<string, string[]>>({})
  const [labelSaving, setLabelSaving] = useState<string | null>(null)

  // SLA editor
  const [slaMap,     setSlaMap]     = useState<Record<string, number>>({})
  const [slaEditing, setSlaEditing] = useState<string | null>(null)
  const [slaDraft,   setSlaDraft]   = useState<number>(7)
  const [slaSaving,  setSlaSaving]  = useState(false)

  // Overview data (Option A flow nodes + C grid)
  const [overview,        setOverview]        = useState<{
    pipelines: OverviewPipeline[]
    grid: GridRow[]
    stage_order: string[]
    order_types: string[]
  } | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)

  // Analytics tab
  const [funnel,           setFunnel]           = useState<FunnelStage[]>([])
  const [velocity,         setVelocity]         = useState<VelocityStage[]>([])
  const [analyticsPeriod,  setAnalyticsPeriod]  = useState(30)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Stale tab
  const [stale,        setStale]        = useState<StaleCustomer[]>([])
  const [staleLoading, setStaleLoading] = useState(false)
  const [staleFilter,  setStaleFilter]  = useState('')

  // ── Auth check ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: me } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (me?.role !== 'admin') { router.push('/dashboard'); return }
      setAuthChecked(true)
    }
    check()
  }, [])

  // ── Load configs + SLA + overview ─────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true)
    setOverviewLoading(true)
    Promise.all([
      fetch('/api/admin/pipeline-config').then(r => r.json()),
      fetch('/api/admin/business-rules').then(r => r.json()).catch(() => ({ settings: {} })),
      fetch('/api/admin/pipeline/overview').then(r => r.json()).catch(() => null),
    ])
      .then(([cfgData, rulesData, ovData]) => {
        setConfigs(cfgData.configs ?? [])
        const slaOverride = rulesData?.settings?.stage_sla_override
        if (slaOverride) {
          try { setSlaMap(typeof slaOverride === 'string' ? JSON.parse(slaOverride) : slaOverride) }
          catch { /* ignore */ }
        }
        if (ovData?.pipelines) {
          setOverview({
            pipelines:   ovData.pipelines,
            grid:        ovData.grid ?? [],
            stage_order: ovData.stage_order ?? [],
            order_types: (ovData.pipelines as OverviewPipeline[]).map((p: OverviewPipeline) => p.order_type),
          })
        }
      })
      .catch(() => setError('Lỗi tải dữ liệu'))
      .finally(() => { setLoading(false); setOverviewLoading(false) })
  }, [])

  useEffect(() => {
    if (authChecked) load()
  }, [authChecked, load])

  // ── Load analytics ────────────────────────────────────────────────────────────
  const loadAnalytics = useCallback((period: number) => {
    setAnalyticsLoading(true)
    Promise.all([
      fetch(`/api/admin/pipeline/funnel?period=${period}`).then(r => r.json()),
      fetch(`/api/admin/pipeline/velocity?period=${period}`).then(r => r.json()),
    ])
      .then(([f, v]) => { setFunnel(f.funnel ?? []); setVelocity(v.velocity ?? []) })
      .catch(() => setError('Lỗi tải analytics'))
      .finally(() => setAnalyticsLoading(false))
  }, [])

  useEffect(() => {
    if (authChecked && activeTab === 'analytics') loadAnalytics(analyticsPeriod)
  }, [authChecked, activeTab, analyticsPeriod, loadAnalytics])

  // ── Load stale ────────────────────────────────────────────────────────────────
  const loadStale = useCallback(() => {
    setStaleLoading(true)
    const url = staleFilter
      ? `/api/admin/pipeline/stale?stage=${encodeURIComponent(staleFilter)}`
      : '/api/admin/pipeline/stale'
    fetch(url)
      .then(r => r.json())
      .then(d => setStale(d.stale ?? []))
      .catch(() => setError('Lỗi tải stale report'))
      .finally(() => setStaleLoading(false))
  }, [staleFilter])

  useEffect(() => {
    if (authChecked && activeTab === 'stale') loadStale()
  }, [authChecked, activeTab, staleFilter, loadStale])

  // ── Toggle pipeline active ────────────────────────────────────────────────────
  const toggleActive = async (cfg: PipelineCfg) => {
    setSaving(cfg.order_type); setError('')
    try {
      const res = await fetch(
        `/api/admin/pipeline-config?order_type=${encodeURIComponent(cfg.order_type)}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: !cfg.is_active }) }
      )
      if (res.ok) {
        setConfigs(prev => prev.map(c =>
          c.order_type === cfg.order_type ? { ...c, is_active: !c.is_active } : c
        ))
        setSuccess(`${!cfg.is_active ? 'Bật' : 'Tắt'} pipeline: ${cfg.display_name}`)
        setTimeout(() => setSuccess(''), 3000)
      } else { const d = await res.json(); setError(d.error || 'Lỗi cập nhật') }
    } catch { setError('Lỗi kết nối') }
    finally { setSaving(null) }
  }

  // ── Save stage labels ─────────────────────────────────────────────────────────
  const saveLabels = async (cfg: PipelineCfg) => {
    const labels = editLabels[cfg.order_type]; if (!labels) return
    setLabelSaving(cfg.order_type)
    try {
      const res = await fetch(
        `/api/admin/pipeline-config?order_type=${encodeURIComponent(cfg.order_type)}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage_labels: labels }) }
      )
      if (res.ok) {
        setConfigs(prev => prev.map(c =>
          c.order_type === cfg.order_type ? { ...c, stage_labels: labels } : c
        ))
        setEditLabels(prev => { const n = { ...prev }; delete n[cfg.order_type]; return n })
        setSuccess(`Đã lưu tên stages: ${cfg.display_name}`)
        setTimeout(() => setSuccess(''), 3000)
        load()  // reload overview
      } else { const d = await res.json(); setError(d.error || 'Lỗi lưu') }
    } catch { setError('Lỗi kết nối') }
    finally { setLabelSaving(null) }
  }

  // ── Save SLA for a stage ──────────────────────────────────────────────────────
  const saveSla = async (stage: string, days: number) => {
    setSlaSaving(true)
    try {
      const newMap = { ...slaMap, [stage]: days }
      const res = await fetch('/api/admin/business-rules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_sla_override: JSON.stringify(newMap) }),
      })
      if (res.ok) {
        setSlaMap(newMap); setSlaEditing(null)
        setSuccess(`SLA: ${stage} = ${days} ngày`)
        setTimeout(() => setSuccess(''), 3000)
        load()  // reload overview
      } else { setError('Lỗi lưu SLA') }
    } catch { setError('Lỗi kết nối') }
    finally { setSlaSaving(false) }
  }

  if (!authChecked || loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-gray-400 text-sm">
        <span className="crm-spinner" /><span>Đang tải...</span>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="pb-32 px-4 pt-5 space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-800">Quy trình bán hàng</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {configs.filter(c => c.is_active).length}/{configs.length} pipeline đang hoạt động
        </p>
      </div>

      {/* Tab switcher */}
      <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl">
        {([
          { key: 'config',    label: '⚙️ Cấu hình'  },
          { key: 'analytics', label: '📊 Phân tích'  },
          { key: 'stale',     label: '⚠️ Stuck KH'  },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`py-2 rounded-lg text-[11px] font-semibold transition-all ${
              activeTab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          ⚠️ {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400">✕</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: CẤU HÌNH
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'config' && <>

        {/* ── Option A: Flow Nodes per pipeline ─────────────────────────────── */}
        {overviewLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(overview?.pipelines ?? []).map(ov => {
              const cfg = configs.find(c => c.order_type === ov.order_type)
              const nodeClass   = ORDER_TYPE_NODE[ov.order_type]   ?? 'bg-gray-50 border-gray-200 text-gray-800'
              const borderClass = ORDER_TYPE_BORDER[ov.order_type] ?? 'border-gray-200'
              return (
                <div
                  key={ov.order_type}
                  className={`bg-white rounded-2xl border p-4 space-y-3 ${
                    ov.is_active ? borderClass : 'border-gray-100 opacity-60'
                  }`}
                >
                  {/* Pipeline header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">{ORDER_TYPE_ICON[ov.order_type]}</span>
                    <span className="text-sm font-bold text-gray-800">
                      {cfg?.display_name?.split('—')[0].trim() ?? ov.order_type}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ORDER_TYPE_COLOR[ov.order_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ov.order_type}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      ov.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {ov.is_active ? 'Đang bật' : 'Đã tắt'}
                    </span>
                    {/* Total KH count */}
                    <span className="ml-auto text-xs text-gray-400 font-semibold">
                      {ov.stages.reduce((s, st) => s + st.count, 0)} KH active
                    </span>
                  </div>

                  {/* Flow Nodes (Option A) */}
                  <FlowNodes
                    pipeline={ov}
                    color={ORDER_TYPE_COLOR[ov.order_type]}
                    nodeClass={nodeClass}
                    borderClass={borderClass}
                  />

                  {/* Config actions (collapse by default) */}
                  <details className="group">
                    <summary className="text-[11px] text-blue-500 cursor-pointer list-none flex items-center gap-1 hover:text-blue-700">
                      <span className="group-open:hidden">▶ Chỉnh sửa cấu hình</span>
                      <span className="hidden group-open:block">▼ Đóng</span>
                    </summary>
                    <div className="mt-3 space-y-3 pt-3 border-t border-gray-50">
                      {/* Toggle */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => cfg && toggleActive(cfg)}
                          disabled={saving === ov.order_type}
                          className={`w-10 h-5.5 rounded-full flex-shrink-0 transition-colors relative disabled:opacity-60 ${
                            ov.is_active ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                          style={{ height: '22px' }}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            ov.is_active ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </button>
                        <span className="text-xs text-gray-500">
                          {ov.is_active ? 'Pipeline đang bật — tắt để ẩn khỏi đơn hàng mới' : 'Pipeline đang tắt'}
                        </span>
                      </div>

                      {/* Stage labels editor */}
                      {cfg && (editLabels[cfg.order_type] ? (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                            Sửa tên hiển thị ({editLabels[cfg.order_type].length} stages)
                          </p>
                          {editLabels[cfg.order_type].map((label, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-5 flex-shrink-0 text-right">{i + 1}.</span>
                              <span className="text-[10px] text-gray-300 font-mono w-8 flex-shrink-0">{cfg.stages[i]}</span>
                              <input
                                value={label}
                                onChange={e => {
                                  const updated = [...editLabels[cfg.order_type]]
                                  updated[i] = e.target.value
                                  setEditLabels(p => ({ ...p, [cfg.order_type]: updated }))
                                }}
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                              {/* SLA */}
                              {slaEditing === `${cfg.order_type}-${i}` ? (
                                <div className="flex items-center gap-1">
                                  <input type="number" value={slaDraft} onChange={e => setSlaDraft(parseInt(e.target.value)||1)}
                                    min={1} max={365}
                                    className="w-12 border border-blue-300 rounded text-[10px] px-1 py-0.5 focus:outline-none" autoFocus />
                                  <button onClick={() => saveSla(label, slaDraft)} disabled={slaSaving}
                                    className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded disabled:opacity-50">✓</button>
                                  <button onClick={() => setSlaEditing(null)} className="text-[10px] text-gray-400">✕</button>
                                </div>
                              ) : (
                                <button onClick={() => { setSlaEditing(`${cfg.order_type}-${i}`); setSlaDraft(slaMap[label]??7) }}
                                  className="text-[10px] text-gray-400 hover:text-blue-500 w-10 text-right flex-shrink-0">
                                  ⏱{slaMap[label] ? `${slaMap[label]}d` : '—'}
                                </button>
                              )}
                            </div>
                          ))}
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => setEditLabels(p => { const n = {...p}; delete n[cfg.order_type]; return n })}
                              className="text-xs text-gray-500 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Huỷ</button>
                            <button onClick={() => saveLabels(cfg)} disabled={labelSaving === cfg.order_type}
                              className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-50 font-medium">
                              {labelSaving === cfg.order_type ? 'Đang lưu...' : '💾 Lưu'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => cfg && setEditLabels(p => ({
                            ...p,
                            [cfg.order_type]: [...(cfg.stage_labels ?? cfg.stages)]
                          }))}
                          className="text-[11px] text-blue-500 hover:text-blue-700"
                        >
                          ✏️ Sửa tên stages
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              )
            })}
          </div>
        )}

        {/* Info banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
          <p className="font-semibold mb-1">⚠️ Lưu ý</p>
          <p>Chỉ đổi được <strong>tên hiển thị</strong> stage. Không thêm/xoá stage. Mã nội bộ (<span className="font-mono">LM, TN, BG...</span>) cố định.</p>
          <p className="mt-1 opacity-80">⏱ Số trên dot = avg ngày KH đang ở stage đó · Dot màu = so với SLA.</p>
        </div>
      </>}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: PHÂN TÍCH
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && <>

        {/* Period picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Khoảng thời gian:</span>
          {[30, 90, 365].map(p => (
            <button key={p} onClick={() => setAnalyticsPeriod(p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                analyticsPeriod === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p === 365 ? '1 năm' : `${p} ngày`}
            </button>
          ))}
        </div>

        {analyticsLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-gray-400 text-sm">
            <span className="crm-spinner" /><span>Đang tải phân tích...</span>
          </div>
        ) : <>

          {/* ── Option C: Comparison Grid ───────────────────────────────────── */}
          {overview && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400">SO SÁNH 3 LOẠI ĐƠN — LIVE</p>
                <button onClick={load} className="text-[10px] text-blue-400 hover:text-blue-600">🔄 Làm mới</button>
              </div>
              <ComparisonGrid
                grid={overview.grid}
                stageOrder={overview.stage_order}
                orderTypes={overview.order_types}
              />
              {/* Summary row */}
              <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 gap-2">
                {(overview.pipelines).map(ov => (
                  <div key={ov.order_type} className={`rounded-xl px-3 py-2 text-center ${ORDER_TYPE_COLOR[ov.order_type] ?? 'bg-gray-100'}`}>
                    <p className="text-xs font-bold">{ov.stages.reduce((s, st) => s + st.count, 0)}</p>
                    <p className="text-[10px] opacity-80">{ov.order_type === 'Thuong_mai' ? 'TM' : ov.order_type} active</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Funnel visualization ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">PHỄU CHUYỂN ĐỔI ({analyticsPeriod} NGÀY)</p>
            {funnel.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2">
                {funnel.filter(s => s.stage !== 'Lost').map(item => {
                  const maxCount = Math.max(...funnel.map(f => f.count), 1)
                  const widthPct = Math.max((item.count / maxCount) * 100, 4)
                  return (
                    <div key={item.stage} className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-500 w-24 flex-shrink-0 text-right truncate">{item.stage}</span>
                      <div className="flex-1 relative h-6 bg-gray-50 rounded-lg overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-blue-100 rounded-lg transition-all" style={{ width: `${widthPct}%` }} />
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-blue-700">
                          {item.count} KH
                        </span>
                      </div>
                      {item.conversion_pct !== null ? (
                        <span className={`text-[10px] font-semibold w-12 text-right ${
                          item.conversion_pct >= 50 ? 'text-green-600' :
                          item.conversion_pct >= 25 ? 'text-amber-600' : 'text-red-500'
                        }`}>{item.conversion_pct}% →</span>
                      ) : (
                        <span className="text-[10px] text-gray-300 w-12 text-right">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Velocity table ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">TỐC ĐỘ — NGÀY Ở MỖI STAGE</p>
            {velocity.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2">
                {velocity.map(item => (
                  <div key={item.stage} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-600 w-24 flex-shrink-0 truncate">{item.stage}</span>
                    <div className="flex-1">
                      {item.status === 'no_data' ? (
                        <span className="text-[10px] text-gray-300 italic">Chưa có dữ liệu</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${
                            item.status === 'ok' ? 'text-green-600' :
                            item.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                          }`}>{item.avg_days}d avg</span>
                          <span className="text-[10px] text-gray-400">p50: {item.median_days}d · p90: {item.p90_days}d</span>
                          <span className="text-[10px] text-gray-300">n={item.sample_count}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">SLA {item.sla_days}d</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${SLA_STATUS_COLOR[item.status]}`}>
                        {item.status === 'ok' ? '✓' : item.status === 'warning' ? '~' : item.status === 'critical' ? '!' : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>}
      </>}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: STUCK KH
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'stale' && <>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Lọc:</span>
          {['', 'Tiềm năng', 'Báo giá', 'Đàm phán', 'Chốt HĐ'].map(stage => (
            <button key={stage} onClick={() => setStaleFilter(stage)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                staleFilter === stage ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {stage || 'Tất cả'}
            </button>
          ))}
          <button onClick={loadStale} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
            🔄 Làm mới
          </button>
        </div>

        {staleLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-gray-400 text-sm">
            <span className="crm-spinner" /><span>Đang tải...</span>
          </div>
        ) : stale.length === 0 ? (
          <div className="bg-green-50 rounded-2xl p-6 text-center border border-green-100">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm font-semibold text-green-700">Không có KH nào quá SLA</p>
            <p className="text-xs text-green-500 mt-1">Tất cả đang trong SLA cho phép</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400">KH STUCK QUÁ SLA</p>
              <span className="text-xs font-bold text-red-500">{stale.length} KH</span>
            </div>
            <div className="divide-y divide-gray-50">
              {stale.map(kh => (
                <button key={kh.id} onClick={() => router.push(`/dashboard/customers/${kh.id}`)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    kh.sla_status === 'critical' ? 'bg-red-500' : 'bg-amber-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{kh.ho_ten}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{kh.nguoi_phu_trach_name ?? 'Chưa phân công'}</p>
                  </div>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">{kh.pipeline}</span>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-bold ${kh.sla_status === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                      {kh.days_stuck}d
                    </p>
                    <p className="text-[10px] text-gray-400">SLA {kh.sla_days}d</p>
                  </div>
                  <span className="text-gray-300 text-sm">›</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </>}

    </div>
  )
}
