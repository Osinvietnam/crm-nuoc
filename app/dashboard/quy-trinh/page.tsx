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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuyTrinhPage() {
  const router   = useRouter()
  const supabase = createClient()

  // Auth guard
  const [authChecked, setAuthChecked] = useState(false)

  // Data
  const [configs,     setConfigs]     = useState<PipelineCfg[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState<string | null>(null)
  const [success,     setSuccess]     = useState('')
  const [error,       setError]       = useState('')
  const [editLabels,  setEditLabels]  = useState<Record<string, string[]>>({})
  const [labelSaving, setLabelSaving] = useState<string | null>(null)

  // ── Auth check — chỉ admin được vào ──────────────────────────────────────────
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
    fetch('/api/admin/pipeline-config')
      .then(r => r.json())
      .then(d => setConfigs(d.configs ?? []))
      .catch(() => setError('Lỗi tải dữ liệu'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (authChecked) load()
  }, [authChecked, load])

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
    <div className="pb-32 px-4 pt-5 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-800">Quy trình bán hàng</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Cấu hình stages cho từng loại đơn hàng · {configs.filter(c => c.is_active).length}/{configs.length} đang hoạt động
        </p>
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
        </div>
      )}

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

              {/* Description */}
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
                /* Stages — view mode */
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {(cfg.stage_labels ?? cfg.stages).map((label, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1"
                      >
                        <span className="text-gray-400">{i + 1}.</span>
                        {label}
                      </span>
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
      </div>

    </div>
  )
}
