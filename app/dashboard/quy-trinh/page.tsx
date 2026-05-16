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

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_TYPE_COLOR: Record<string, string> = {
  B2C:        'bg-blue-100 text-blue-700',
  Thuong_mai: 'bg-green-100 text-green-700',
  Du_an:      'bg-purple-100 text-purple-700',
}

const ORDER_TYPE_ICON: Record<string, string> = {
  B2C:        '🏠',
  Thuong_mai: '🏢',
  Du_an:      '🏗️',
}

const SLA_STATUS_COLOR = {
  ok:       'text-green-600 bg-green-50',
  warning:  'text-amber-600 bg-amber-50',
  critical: 'text-red-600 bg-red-50',
  no_data:  'text-gray-400 bg-gray-50',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuyTrinhPage() {
  const router   = useRouter()
  const supabase = createClient()

  // Auth guard
  const [authChecked, setAuthChecked] = useState(false)

  // Tab
  const [activeTab, setActiveTab] = useState<'config' | 'analytics' | 'stale'>('config')

  // Config tab data
  const [configs,     setConfigs]     = useState<PipelineCfg[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState<string | null>(null)
  const [success,     setSuccess]     = useState('')
  const [error,       setError]       = useState('')
  const [editLabels,  setEditLabels]  = useState<Record<string, string[]>>({})
  const [labelSaving, setLabelSaving] = useState<string | null>(null)

  // SLA editor state
  const [slaMap,     setSlaMap]     = useState<Record<string, number>>({})
  const [slaEditing, setSlaEditing] = useState<string | null>(null)  // stage being edited
  const [slaDraft,   setSlaDraft]   = useState<number>(7)
  const [slaSaving,  setSlaSaving]  = useState(false)

  // Analytics tab data
  const [funnel,         setFunnel]         = useState<FunnelStage[]>([])
  const [velocity,       setVelocity]       = useState<VelocityStage[]>([])
  const [analyticsPeriod, setAnalyticsPeriod] = useState(30)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Stale tab data
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

      if (me?.role !== 'admin') {
        router.push('/dashboard')
        return
      }
      setAuthChecked(true)
    }
    check()
  }, [])

  // ── Load pipeline configs ─────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/pipeline-config').then(r => r.json()),
      fetch('/api/admin/business-rules').then(r => r.json()).catch(() => ({ settings: {} })),
    ])
      .then(([cfgData, rulesData]) => {
        setConfigs(cfgData.configs ?? [])
        // Parse SLA overrides from company_settings
        const slaOverride = rulesData?.settings?.stage_sla_override
        if (slaOverride) {
          try {
            setSlaMap(typeof slaOverride === 'string' ? JSON.parse(slaOverride) : slaOverride)
          } catch { /* ignore */ }
        }
      })
      .catch(() => setError('Lỗi tải dữ liệu'))
      .finally(() => setLoading(false))
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
      .then(([f, v]) => {
        setFunnel(f.funnel ?? [])
        setVelocity(v.velocity ?? [])
      })
      .catch(() => setError('Lỗi tải analytics'))
      .finally(() => setAnalyticsLoading(false))
  }, [])

  useEffect(() => {
    if (authChecked && activeTab === 'analytics') {
      loadAnalytics(analyticsPeriod)
    }
  }, [authChecked, activeTab, analyticsPeriod, loadAnalytics])

  // ── Load stale customers ───────────────────────────────────────────────────────
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

  // ── Toggle bật/tắt pipeline ───────────────────────────────────────────────────
  const toggleActive = async (cfg: PipelineCfg) => {
    setSaving(cfg.order_type)
    setError('')
    try {
      const res = await fetch(
        `/api/admin/pipeline-config?order_type=${encodeURIComponent(cfg.order_type)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: !cfg.is_active }),
        }
      )
      if (res.ok) {
        setConfigs(prev => prev.map(c =>
          c.order_type === cfg.order_type ? { ...c, is_active: !c.is_active } : c
        ))
        setSuccess(`${!cfg.is_active ? 'Bật' : 'Tắt'} pipeline: ${cfg.display_name}`)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const d = await res.json()
        setError(d.error || 'Lỗi cập nhật')
      }
    } catch {
      setError('Lỗi kết nối')
    } finally {
      setSaving(null)
    }
  }

  // ── Lưu tên stages ────────────────────────────────────────────────────────────
  const saveLabels = async (cfg: PipelineCfg) => {
    const labels = editLabels[cfg.order_type]
    if (!labels) return
    setLabelSaving(cfg.order_type)
    try {
      const res = await fetch(
        `/api/admin/pipeline-config?order_type=${encodeURIComponent(cfg.order_type)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage_labels: labels }),
        }
      )
      if (res.ok) {
        setConfigs(prev => prev.map(c =>
          c.order_type === cfg.order_type ? { ...c, stage_labels: labels } : c
        ))
        setEditLabels(prev => {
          const n = { ...prev }
          delete n[cfg.order_type]
          return n
        })
        setSuccess(`Đã lưu tên stages: ${cfg.display_name}`)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const d = await res.json()
        setError(d.error || 'Lỗi lưu')
      }
    } catch {
      setError('Lỗi kết nối')
    } finally {
      setLabelSaving(null)
    }
  }

  // ── Lưu SLA cho 1 stage ───────────────────────────────────────────────────────
  const saveSla = async (stage: string, days: number) => {
    setSlaSaving(true)
    try {
      const newMap = { ...slaMap, [stage]: days }
      const res = await fetch('/api/admin/business-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_sla_override: JSON.stringify(newMap) }),
      })
      if (res.ok) {
        setSlaMap(newMap)
        setSlaEditing(null)
        setSuccess(`Đã cập nhật SLA: ${stage} = ${days} ngày`)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError('Lỗi lưu SLA')
      }
    } catch {
      setError('Lỗi kết nối')
    } finally {
      setSlaSaving(false)
    }
  }

  // ── Loading / auth pending ────────────────────────────────────────────────────
  if (!authChecked || loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-gray-400 text-sm">
        <span className="crm-spinner" />
        <span>Đang tải...</span>
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
          Pipeline · SLA · Phân tích · Báo cáo stuck
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
          <span>✅</span> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <span>⚠️</span> {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── TAB: Cấu hình ──────────────────────────────────────────────────────── */}
      {activeTab === 'config' && <>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          {configs.map(cfg => (
            <div
              key={cfg.order_type}
              className={`rounded-xl px-3 py-2.5 text-center border transition-opacity ${
                cfg.is_active
                  ? ORDER_TYPE_COLOR[cfg.order_type] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                  : 'bg-gray-50 text-gray-400 border-gray-100 opacity-60'
              }`}
            >
              <p className="text-lg leading-none mb-1">{ORDER_TYPE_ICON[cfg.order_type] ?? '🔀'}</p>
              <p className="text-[10px] font-semibold leading-tight">{cfg.display_name.split('—')[0].trim()}</p>
              <p className="text-[10px] opacity-70 mt-0.5">{cfg.stages.length} stages</p>
            </div>
          ))}
        </div>

        {/* Pipeline cards */}
        {configs.map(cfg => (
          <div
            key={cfg.order_type}
            className={`bg-white rounded-2xl border overflow-hidden transition-opacity ${
              cfg.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'
            }`}
          >
            <div className="px-4 py-4 flex items-start gap-3">

              {/* Toggle */}
              <button
                onClick={() => toggleActive(cfg)}
                disabled={saving === cfg.order_type}
                className={`mt-0.5 w-11 h-6 rounded-full flex-shrink-0 transition-colors relative disabled:opacity-60 ${
                  cfg.is_active ? 'bg-green-500' : 'bg-gray-200'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  cfg.is_active ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>

              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">{cfg.display_name}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    ORDER_TYPE_COLOR[cfg.order_type] ?? 'bg-gray-100 text-gray-600'
                  }`}>
                    {cfg.order_type}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    cfg.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {cfg.is_active ? 'Đang bật' : 'Đã tắt'}
                  </span>
                </div>

                {cfg.description && (
                  <p className="text-xs text-gray-500 mb-2 leading-relaxed">{cfg.description}</p>
                )}

                {/* Stages — edit mode */}
                {editLabels[cfg.order_type] ? (
                  <div className="space-y-1.5 mt-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
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
                        {/* SLA badge per stage */}
                        <span className="text-[10px] text-gray-400 font-mono w-10 flex-shrink-0">
                          {slaMap[label] ? `${slaMap[label]}d` : '—'}
                        </span>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2.5">
                      <button
                        onClick={() => setEditLabels(p => { const n = { ...p }; delete n[cfg.order_type]; return n })}
                        className="text-xs text-gray-500 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Huỷ
                      </button>
                      <button
                        onClick={() => saveLabels(cfg)}
                        disabled={labelSaving === cfg.order_type}
                        className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-50 font-medium"
                      >
                        {labelSaving === cfg.order_type ? 'Đang lưu...' : '💾 Lưu tên stage'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Stages — view mode với SLA badges */
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1">
                      {(cfg.stage_labels ?? cfg.stages).map((label, i) => (
                        <div key={i} className="flex items-center gap-0.5">
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="text-gray-400">{i + 1}.</span>
                            {label}
                          </span>
                          {/* SLA inline editor */}
                          {slaEditing === `${cfg.order_type}-${i}` ? (
                            <div className="flex items-center gap-1 ml-0.5">
                              <input
                                type="number"
                                value={slaDraft}
                                onChange={e => setSlaDraft(parseInt(e.target.value) || 1)}
                                min={1} max={365}
                                className="w-12 border border-blue-300 rounded text-[10px] px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                autoFocus
                              />
                              <button
                                onClick={() => saveSla(label, slaDraft)}
                                disabled={slaSaving}
                                className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-medium disabled:opacity-50"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setSlaEditing(null)}
                                className="text-[10px] text-gray-400 px-1"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setSlaEditing(`${cfg.order_type}-${i}`)
                                setSlaDraft(slaMap[label] ?? 7)
                              }}
                              className="text-[10px] text-gray-400 hover:text-blue-500 px-1 py-0.5 rounded hover:bg-blue-50 transition-colors"
                              title={`SLA: ${slaMap[label] ?? '—'} ngày`}
                            >
                              {slaMap[label] ? `⏱${slaMap[label]}d` : '⏱—'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setEditLabels(p => ({
                        ...p,
                        [cfg.order_type]: [...(cfg.stage_labels ?? cfg.stages)]
                      }))}
                      className="text-[10px] text-blue-500 px-2 py-0.5 rounded-full bg-blue-50 mt-2 hover:bg-blue-100 transition-colors"
                    >
                      ✏️ Sửa tên stages
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stage flow visualizer */}
            <div className="px-4 pb-4 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {(cfg.stage_labels ?? cfg.stages).map((label, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className={`text-[10px] px-2 py-1 rounded-lg font-medium whitespace-nowrap ${
                      cfg.is_active
                        ? ORDER_TYPE_COLOR[cfg.order_type] ?? 'bg-gray-100 text-gray-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {label}
                      {slaMap[label] && (
                        <span className="ml-1 opacity-60">·{slaMap[label]}d</span>
                      )}
                    </div>
                    {i < (cfg.stage_labels ?? cfg.stages).length - 1 && (
                      <span className="text-gray-300 text-[10px]">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Info banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
          <p className="font-semibold mb-1">⚠️ Lưu ý quan trọng</p>
          <p>Chỉ có thể đổi <strong>tên hiển thị</strong> của stage. Không thêm/xoá stage vì ảnh hưởng đến dữ liệu toàn hệ thống — mã stage nội bộ (<span className="font-mono">LM, TN, BG...</span>) không thay đổi.</p>
          <p className="mt-1 opacity-80">⏱ Bấm vào badge SLA (ví dụ: <span className="font-mono">⏱7d</span>) cạnh mỗi stage để chỉnh số ngày SLA.</p>
        </div>
      </>}

      {/* ── TAB: Phân tích ─────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && <>

        {/* Period picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Khoảng thời gian:</span>
          {[30, 90, 365].map(p => (
            <button
              key={p}
              onClick={() => setAnalyticsPeriod(p)}
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
            <span className="crm-spinner" /><span>Đang tải dữ liệu phân tích...</span>
          </div>
        ) : <>

          {/* Funnel visualization */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">PHỄU CHUYỂN ĐỔI ({analyticsPeriod} NGÀY QUA)</p>
            {funnel.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2">
                {funnel.filter(s => s.stage !== 'Lost').map((item) => {
                  const maxCount = Math.max(...funnel.map(f => f.count), 1)
                  const widthPct = Math.max((item.count / maxCount) * 100, 4)
                  return (
                    <div key={item.stage} className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-500 w-24 flex-shrink-0 text-right truncate">{item.stage}</span>
                      <div className="flex-1 relative h-6 bg-gray-50 rounded-lg overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-blue-100 rounded-lg transition-all"
                          style={{ width: `${widthPct}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-blue-700">
                          {item.count} KH
                        </span>
                      </div>
                      {item.conversion_pct !== null ? (
                        <span className={`text-[10px] font-semibold w-12 text-right ${
                          item.conversion_pct >= 50 ? 'text-green-600' :
                          item.conversion_pct >= 25 ? 'text-amber-600' : 'text-red-500'
                        }`}>
                          {item.conversion_pct}% →
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300 w-12 text-right">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Velocity table */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">TỐC ĐỘ PIPELINE — NGÀY Ở MỖI STAGE</p>
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
                          }`}>
                            {item.avg_days}d avg
                          </span>
                          <span className="text-[10px] text-gray-400">
                            p50: {item.median_days}d · p90: {item.p90_days}d
                          </span>
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

      {/* ── TAB: Stuck KH ──────────────────────────────────────────────────────── */}
      {activeTab === 'stale' && <>

        {/* Filter by stage */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Lọc stage:</span>
          {['', 'Tiềm năng', 'Báo giá', 'Đàm phán', 'Chốt HĐ'].map(stage => (
            <button
              key={stage}
              onClick={() => setStaleFilter(stage)}
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
            <p className="text-xs text-green-500 mt-1">Tất cả khách hàng đang trong SLA cho phép</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400">KH ĐANG BỊ STUCK QUÁ SLA</p>
              <span className="text-xs font-bold text-red-500">{stale.length} KH</span>
            </div>
            <div className="divide-y divide-gray-50">
              {stale.map(kh => (
                <button
                  key={kh.id}
                  onClick={() => router.push(`/dashboard/customers/${kh.id}`)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Status dot */}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    kh.sla_status === 'critical' ? 'bg-red-500' : 'bg-amber-400'
                  }`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{kh.ho_ten}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {kh.nguoi_phu_trach_name ?? 'Chưa phân công'}
                    </p>
                  </div>

                  {/* Stage */}
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">
                    {kh.pipeline}
                  </span>

                  {/* Days */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-bold ${
                      kh.sla_status === 'critical' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {kh.days_stuck}d
                    </p>
                    <p className="text-[10px] text-gray-400">
                      SLA {kh.sla_days}d
                    </p>
                  </div>

                  <span className="text-gray-300 text-sm">›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-gray-400 px-1">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Quá SLA (warning)</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Quá SLA 2x (critical)</div>
        </div>
      </>}

    </div>
  )
}
