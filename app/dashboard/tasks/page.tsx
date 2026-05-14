'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MyTask {
  completion_id:      number
  task_definition_id: number
  task_key:           string
  label:              string
  stage_code:         string
  bo_phan:            string
  status:             'chua_lam' | 'dang_lam' | 'kiem_tra' | 'blocked'
  customer_record_id: number | null
  customer_name:      string | null
  customer_pipeline:  string | null
  order_id:           number | null
  updated_at:         string | null
  updated_by_name:    string | null
  blocked_reason:     string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  chua_lam: 'Chưa làm',
  dang_lam: 'Đang làm',
  kiem_tra: 'Chờ kiểm tra',
  blocked:  'Bị chặn',
}

const STATUS_COLOR: Record<string, string> = {
  chua_lam: 'bg-gray-100 text-gray-600',
  dang_lam: 'bg-blue-100 text-blue-700',
  kiem_tra: 'bg-yellow-100 text-yellow-700',
  blocked:  'bg-red-100 text-red-600',
}

const STATUS_ORDER = ['dang_lam', 'kiem_tra', 'blocked', 'chua_lam']

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const router    = useRouter()
  const showToast = useToast()
  const [tasks,    setTasks]   = useState<MyTask[]>([])
  const [loading,  setLoading] = useState(true)
  const [filter,   setFilter]  = useState<string>('all')
  const [updating, setUpdating]= useState<number | null>(null)
  const [myRole,   setMyRole]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [taskRes, meRes] = await Promise.all([
        fetch('/api/tasks/my'),
        fetch('/api/auth/me'),
      ])
      const taskJson = await taskRes.json()
      const meJson   = await meRes.json()
      setTasks(taskJson.data ?? [])
      setMyRole(meJson?.role ?? '')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updateStatus = async (completionId: number, newStatus: string) => {
    setUpdating(completionId)
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: completionId, status: newStatus }),
      })
      if (!res.ok) {
        showToast('Không thể cập nhật trạng thái', true)
        return
      }
      setTasks(prev => prev.map(t =>
        t.completion_id === completionId ? { ...t, status: newStatus as MyTask['status'] } : t
      ))
    } catch {
      showToast('Lỗi kết nối', true)
    } finally {
      setUpdating(null)
    }
  }

  const resetTask = async (completionId: number) => {
    setUpdating(completionId)
    try {
      await fetch(`/api/tasks?id=${completionId}`, { method: 'DELETE' })
      setTasks(prev => prev.filter(t => t.completion_id !== completionId))
    } finally {
      setUpdating(null)
    }
  }

  const isManager = ['admin', 'ceo', 'director'].includes(myRole)

  const filtered = tasks
    .filter(t => filter === 'all' || t.status === filter)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))

  const counts: Record<string, number> = {}
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1

  // Next valid status transitions
  function nextStatuses(status: string): string[] {
    switch (status) {
      case 'chua_lam': return ['dang_lam']
      case 'dang_lam': return ['kiem_tra', 'blocked']
      case 'kiem_tra': return ['hoan_thanh']
      case 'blocked':  return ['dang_lam']
      default:         return []
    }
  }

  const ACTION_LABEL: Record<string, string> = {
    dang_lam:   'Bắt đầu',
    kiem_tra:   'Gửi kiểm tra',
    hoan_thanh: 'Hoàn thành',
    blocked:    'Báo bị chặn',
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Công việc của tôi</h1>
            <p className="text-xs text-gray-500">{tasks.length} task chưa hoàn thành</p>
          </div>
          <button onClick={load} className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
            Làm mới
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { key: 'all',      label: 'Tất cả', count: tasks.length },
            { key: 'dang_lam', label: 'Đang làm', count: counts.dang_lam ?? 0 },
            { key: 'kiem_tra', label: 'Chờ duyệt', count: counts.kiem_tra ?? 0 },
            { key: 'blocked',  label: 'Bị chặn', count: counts.blocked ?? 0 },
            { key: 'chua_lam', label: 'Chưa làm', count: counts.chua_lam ?? 0 },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {f.label}
              {f.count > 0 && (
                <span className={`text-[10px] px-1 rounded-full ${
                  filter === f.key ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{f.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="crm-spinner" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <span className="text-4xl">✅</span>
            <p className="text-gray-500 text-sm font-medium">
              {filter === 'all' ? 'Không có công việc nào!' : 'Không có task nào ở trạng thái này'}
            </p>
          </div>
        )}

        {!loading && filtered.map(t => (
          <div key={t.completion_id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                  <span className="text-xs text-gray-400">{t.bo_phan}</span>
                </div>

                <p className="text-sm font-semibold text-gray-800">{t.label}</p>

                {t.customer_name && (
                  <button
                    onClick={() => t.customer_record_id && router.push(`/dashboard/customers/${t.customer_record_id}`)}
                    className="text-xs text-blue-600 mt-0.5 hover:underline text-left"
                  >
                    {t.customer_name}
                    {t.customer_pipeline ? ` · ${t.customer_pipeline}` : ''}
                  </button>
                )}

                {t.blocked_reason && (
                  <p className="text-xs text-red-500 mt-1">Lý do: {t.blocked_reason}</p>
                )}

                {t.updated_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    Cập nhật: {new Date(t.updated_at).toLocaleDateString('vi-VN')}
                    {t.updated_by_name ? ` bởi ${t.updated_by_name}` : ''}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {nextStatuses(t.status).map(ns => (
                  <button key={ns}
                    onClick={() => updateStatus(t.completion_id, ns)}
                    disabled={updating === t.completion_id}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl disabled:opacity-50 whitespace-nowrap ${
                      ns === 'hoan_thanh' ? 'bg-green-600 text-white hover:bg-green-700'
                      : ns === 'blocked'  ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                    }`}>
                    {updating === t.completion_id ? '...' : ACTION_LABEL[ns] ?? ns}
                  </button>
                ))}
                {isManager && (
                  <button onClick={() => { if (confirm('Đặt lại task về Chưa làm?')) resetTask(t.completion_id) }}
                    disabled={updating === t.completion_id}
                    className="text-[10px] text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg disabled:opacity-50">
                    Đặt lại
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
