'use client'

import { useEffect, useState, useCallback } from 'react'
import type { TaskWithStatus } from '@/app/api/tasks/route'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  chua_lam:  { label: 'Chưa làm', dot: 'bg-gray-300',   ring: 'border-gray-200',  text: 'text-gray-400'  },
  dang_lam:  { label: 'Đang làm', dot: 'bg-amber-400',  ring: 'border-amber-300', text: 'text-amber-600' },
  kiem_tra:  { label: 'Kiểm tra', dot: 'bg-blue-400',   ring: 'border-blue-300',  text: 'text-blue-600'  },
  hoan_thanh:{ label: 'Hoàn thành',dot:'bg-green-500',  ring: 'border-green-400', text: 'text-green-600' },
  blocked:   { label: 'Bị chặn',  dot: 'bg-red-400',   ring: 'border-red-300',   text: 'text-red-500'   },
} as const

const BO_PHAN_LABEL: Record<string, string> = {
  KD:  'Kinh doanh',
  KT:  'Kỹ thuật',
  KTO: 'Kế toán',
  BLD: 'Ban lãnh đạo',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  customerId: string   // LarkBase record_id (customer_record_id)
  orderId?:   number   // Supabase orders.id (nếu có)
  stage:      string   // pipeline stage label
  userRole:   string
  userFullName?: string
}

// ─── Blocked Reason Modal ─────────────────────────────────────────────────────

function BlockedModal({
  task,
  onConfirm,
  onClose,
}: {
  task:      TaskWithStatus
  onConfirm: (reason: string, waitingFor: string) => void
  onClose:   () => void
}) {
  const [reason,     setReason]     = useState(task.blocked_reason ?? '')
  const [waitingFor, setWaitingFor] = useState(task.blocked_waiting_for ?? '')

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Đánh dấu bị chặn</h2>
          <button onClick={onClose} className="text-gray-400 p-1 text-lg">✕</button>
        </div>
        <div className="p-5 space-y-4 pb-8">
          <p className="text-sm text-gray-500">{task.label}</p>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Lý do bị chặn *</label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Mô tả vấn đề..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Chờ ai / bộ phận nào?</label>
            <input
              type="text"
              value={waitingFor}
              onChange={e => setWaitingFor(e.target.value)}
              placeholder="Ví dụ: KT xác nhận bản vẽ"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim(), waitingFor.trim())}
            disabled={!reason.trim()}
            className="w-full py-3.5 bg-red-500 disabled:bg-red-300 text-white font-semibold rounded-2xl active:bg-red-600"
          >
            Xác nhận bị chặn
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Action Sheet ────────────────────────────────────────────────────────

function TaskActionSheet({
  task,
  onTransition,
  onBlock,
  onUpload,
  uploading,
  onClose,
}: {
  task:         TaskWithStatus
  onTransition: (newStatus: string) => void
  onBlock:      () => void
  onUpload:     (file: File) => void
  uploading:    boolean
  onClose:      () => void
}) {
  const sc = STATUS_CONFIG[task.status]

  // Định nghĩa các action available
  const actions: { label: string; status: string; color: string; requires: 'update' | 'approve' }[] = []

  if (task.status === 'chua_lam' && task.can_update) {
    actions.push({ label: '▶ Bắt đầu làm', status: 'dang_lam', color: 'bg-amber-500', requires: 'update' })
  }
  if (task.status === 'dang_lam' && task.can_update) {
    actions.push({ label: '🔍 Chuyển kiểm tra', status: 'kiem_tra', color: 'bg-blue-500', requires: 'update' })
  }
  if (task.status === 'kiem_tra') {
    if (task.can_approve) {
      actions.push({ label: '✓ Duyệt hoàn thành', status: 'hoan_thanh', color: 'bg-green-500', requires: 'approve' })
    }
    if (task.can_update) {
      actions.push({ label: '↩ Trả lại đang làm', status: 'dang_lam', color: 'bg-amber-500', requires: 'update' })
    }
  }
  if (task.status === 'blocked' && task.can_update) {
    actions.push({ label: '↩ Tiếp tục làm', status: 'dang_lam', color: 'bg-amber-500', requires: 'update' })
    actions.push({ label: '🔍 Chuyển kiểm tra', status: 'kiem_tra', color: 'bg-blue-500', requires: 'update' })
  }
  if (task.status === 'hoan_thanh' && task.can_update) {
    actions.push({ label: '↩ Đặt lại đang làm', status: 'dang_lam', color: 'bg-gray-500', requires: 'update' })
  }

  const canBlock = task.can_update && ['dang_lam', 'kiem_tra'].includes(task.status)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Task header */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot}`} />
            <span className={`text-xs font-semibold ${sc.text}`}>{sc.label}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">
              {BO_PHAN_LABEL[task.bo_phan] ?? task.bo_phan}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{task.label}</p>
          {task.status === 'blocked' && task.blocked_reason && (
            <p className="text-xs text-red-500 mt-1">🚫 {task.blocked_reason}</p>
          )}
          {task.updated_by_name && task.updated_at && (
            <p className="text-xs text-gray-400 mt-0.5">
              Cập nhật bởi {task.updated_by_name} · {new Date(task.updated_at).toLocaleDateString('vi-VN')}
            </p>
          )}
        </div>

        <div className="p-4 space-y-2.5 pb-8">
          {/* Transition actions */}
          {actions.map(a => (
            <button
              key={a.status}
              onClick={() => { onTransition(a.status); onClose() }}
              className={`w-full py-3 ${a.color} text-white font-semibold rounded-2xl text-sm active:opacity-80`}
            >
              {a.label}
            </button>
          ))}

          {/* Block action */}
          {canBlock && (
            <button
              onClick={() => { onBlock(); onClose() }}
              className="w-full py-3 bg-red-50 border border-red-200 text-red-600 font-semibold rounded-2xl text-sm active:bg-red-100"
            >
              🚫 Đánh dấu bị chặn
            </button>
          )}

          {/* File upload */}
          {task.requires_attachment && (task.can_update || task.can_approve) && (
            <label className="block w-full">
              <div className={`w-full py-3 border-2 border-dashed rounded-2xl text-center text-sm font-semibold cursor-pointer transition-colors ${
                task.attachment_url
                  ? 'border-green-300 bg-green-50 text-green-600'
                  : 'border-gray-200 text-gray-500 active:bg-gray-50'
              }`}>
                {uploading
                  ? '📤 Đang tải lên...'
                  : task.attachment_url
                    ? '📎 Thay đổi tệp đính kèm'
                    : '📎 Đính kèm tệp / ảnh *'}
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*,.pdf,.docx,.xlsx"
                onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
            </label>
          )}

          {/* View attachment */}
          {task.attachment_url && (
            <a
              href={task.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2.5 text-center text-xs text-blue-600 bg-blue-50 rounded-xl"
            >
              📄 Xem tệp đính kèm
            </a>
          )}

          {actions.length === 0 && !canBlock && !task.requires_attachment && (
            <p className="text-sm text-gray-400 text-center py-2">Bạn không có quyền thao tác task này</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onTap,
  isActive,
}: {
  task:     TaskWithStatus
  onTap:    () => void
  isActive: boolean
}) {
  const sc        = STATUS_CONFIG[task.status]
  const isActionable = task.can_update || task.can_approve
  const isOptional   = task.task_type === 'optional'

  return (
    <button
      onClick={onTap}
      disabled={!isActionable && task.status === 'chua_lam'}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
        isActive ? 'bg-blue-50' : isActionable ? 'active:bg-gray-50' : ''
      } ${!isActionable ? 'opacity-50' : ''}`}
    >
      {/* Status dot */}
      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${sc.ring} ${
        task.status === 'hoan_thanh' ? 'bg-green-500 border-green-500' :
        task.status === 'blocked'    ? 'bg-red-100' :
        task.status === 'kiem_tra'   ? 'bg-blue-50' :
        task.status === 'dang_lam'   ? 'bg-amber-50' : 'bg-white'
      }`}>
        {task.status === 'hoan_thanh' ? (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : task.status === 'blocked' ? (
          <span className="text-[9px] text-red-500 font-bold">✕</span>
        ) : task.status === 'kiem_tra' ? (
          <span className="text-[9px] text-blue-500 font-bold">?</span>
        ) : task.status === 'dang_lam' ? (
          <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
        ) : null}
      </div>

      {/* Label + meta */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${
          task.status === 'hoan_thanh' ? 'line-through text-gray-400' :
          task.status === 'blocked'    ? 'text-red-600' :
          'text-gray-700'
        }`}>
          {task.label}
          {isOptional && <span className="text-[10px] text-gray-400 ml-1">(tuỳ chọn)</span>}
          {task.requires_attachment && !task.attachment_url && task.status !== 'hoan_thanh' && (
            <span className="text-[10px] text-orange-500 ml-1">📎</span>
          )}
        </p>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full leading-tight">
            {BO_PHAN_LABEL[task.bo_phan] ?? task.bo_phan}
          </span>
          {task.status !== 'chua_lam' && (
            <span className={`text-[10px] font-medium ${sc.text}`}>{sc.label}</span>
          )}
          {task.status === 'blocked' && task.blocked_reason && (
            <span className="text-[10px] text-red-400 truncate max-w-[180px]">{task.blocked_reason}</span>
          )}
          {task.status === 'hoan_thanh' && task.updated_by_name && (
            <span className="text-[10px] text-gray-400">
              {task.updated_by_name} · {task.updated_at ? new Date(task.updated_at).toLocaleDateString('vi-VN') : ''}
            </span>
          )}
        </div>
      </div>

      {/* Chevron (if actionable) */}
      {isActionable && (
        <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TaskChecklist({ customerId, orderId, stage, userRole, userFullName }: Props) {
  const [tasks,        setTasks]        = useState<TaskWithStatus[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeTask,   setActiveTask]   = useState<TaskWithStatus | null>(null)
  const [showBlocked,  setShowBlocked]  = useState<TaskWithStatus | null>(null)
  const [transitioning,setTransitioning]= useState<Set<string>>(new Set())
  const [uploading,    setUploading]    = useState(false)

  // Build query string — prefer order_id; fallback to customer_record_id
  const queryParam = orderId
    ? `order_id=${orderId}`
    : `customer_record_id=${encodeURIComponent(customerId)}`

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/tasks?${queryParam}&stage=${encodeURIComponent(stage)}`)
      .then(r => r.json())
      .then(d => setTasks(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [queryParam, stage])

  useEffect(() => { load() }, [load])

  // ── Transition handler ─────────────────────────────────────────────────────

  const transition = async (task: TaskWithStatus, newStatus: string, extra?: {
    blocked_reason?: string
    blocked_waiting_for?: string
    attachment_url?: string
  }) => {
    setTransitioning(prev => new Set(prev).add(task.task_key))
    try {
      let res: Response

      if (task.status === 'chua_lam') {
        // POST — tạo mới completion
        res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_record_id: customerId,
            ...(orderId ? { order_id: orderId } : {}),
            stage,
            task_key: task.task_key,
            status:   newStatus,
            ...extra,
          }),
        })
      } else {
        // PATCH — cập nhật
        res = await fetch('/api/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id:     task.completion_id,
            status: newStatus,
            ...extra,
          }),
        })
      }

      if (res.ok) {
        // Optimistic update + reload để sync
        load()
      }
    } catch {}
    finally {
      setTransitioning(prev => { const s = new Set(prev); s.delete(task.task_key); return s })
    }
  }

  // ── File upload handler ────────────────────────────────────────────────────

  const handleUpload = async (task: TaskWithStatus, file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('task_key', task.task_key)
      form.append('customer_id', customerId)

      const res = await fetch('/api/tasks/upload', { method: 'POST', body: form })
      const d   = await res.json()
      if (d.url) {
        await transition(task, task.status === 'chua_lam' ? 'dang_lam' : task.status, {
          attachment_url: d.url,
        })
      }
    } catch {}
    finally { setUploading(false) }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const mandatory   = tasks.filter(t => t.task_type === 'mandatory')
  const optional    = tasks.filter(t => t.task_type !== 'mandatory')
  const done        = tasks.filter(t => t.status === 'hoan_thanh').length
  const blocked     = tasks.filter(t => t.status === 'blocked').length
  const inProgress  = tasks.filter(t => ['dang_lam', 'kiem_tra'].includes(t.status)).length

  if (!loading && tasks.length === 0) return null

  // Group tasks by bo_phan
  const grouped = tasks.reduce<Record<string, TaskWithStatus[]>>((acc, t) => {
    const k = t.bo_phan
    if (!acc[k]) acc[k] = []
    acc[k].push(t)
    return acc
  }, {})

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400">VIỆC CẦN LÀM — {stage.toUpperCase()}</p>
            <div className="flex items-center gap-2">
              {blocked > 0 && (
                <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  🚫 {blocked} bị chặn
                </span>
              )}
              {inProgress > 0 && (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  ⏳ {inProgress} đang làm
                </span>
              )}
              <span className="text-xs font-semibold text-gray-500">{done}/{tasks.length}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 rounded-full transition-all duration-500"
              style={{ width: `${tasks.length > 0 ? (done / tasks.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <span className="crm-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          </div>
        ) : (
          <>
            {/* Mandatory tasks grouped by bo_phan */}
            {mandatory.length > 0 && (
              <div className="border-t border-gray-50 mt-2">
                {Object.entries(grouped)
                  .filter(([, ts]) => ts.some(t => t.task_type === 'mandatory'))
                  .map(([bp, ts]) => {
                    const mandatoryInBp = ts.filter(t => t.task_type === 'mandatory')
                    if (mandatoryInBp.length === 0) return null
                    return (
                      <div key={bp}>
                        <div className="px-4 pt-3 pb-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {BO_PHAN_LABEL[bp] ?? bp}
                          </span>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {mandatoryInBp.map(task => (
                            <TaskRow
                              key={task.task_key}
                              task={task}
                              isActive={activeTask?.task_key === task.task_key}
                              onTap={() => setActiveTask(task)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}

            {/* Optional tasks */}
            {optional.length > 0 && (
              <div className="border-t border-gray-50">
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tùy chọn</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {optional.map(task => (
                    <TaskRow
                      key={task.task_key}
                      task={task}
                      isActive={activeTask?.task_key === task.task_key}
                      onTap={() => setActiveTask(task)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action sheet */}
      {activeTask && (
        <TaskActionSheet
          task={activeTask}
          uploading={uploading}
          onTransition={newStatus => {
            transition(activeTask, newStatus)
            setActiveTask(null)
          }}
          onBlock={() => {
            setShowBlocked(activeTask)
            setActiveTask(null)
          }}
          onUpload={file => {
            handleUpload(activeTask, file)
            setActiveTask(null)
          }}
          onClose={() => setActiveTask(null)}
        />
      )}

      {/* Blocked reason modal */}
      {showBlocked && (
        <BlockedModal
          task={showBlocked}
          onConfirm={(reason, waitingFor) => {
            transition(showBlocked, 'blocked', {
              blocked_reason:      reason,
              blocked_waiting_for: waitingFor || undefined,
            })
            setShowBlocked(null)
          }}
          onClose={() => setShowBlocked(null)}
        />
      )}
    </>
  )
}
