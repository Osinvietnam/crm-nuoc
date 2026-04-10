'use client'

import { useEffect, useState, useCallback } from 'react'
import { STAGE_TASKS, canCompleteTask } from '@/lib/tasks/checklist'

interface Completion {
  id: number
  task_key: string
  completed_by_name: string
  completed_at: string
}

interface Props {
  customerId: string
  stage: string
  userRole: string
}

export function TaskChecklist({ customerId, stage, userRole }: Props) {
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading]         = useState(true)
  const [toggling, setToggling]       = useState<Set<string>>(new Set())

  const tasks = STAGE_TASKS[stage] ?? []

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/tasks?customer_record_id=${customerId}&stage=${encodeURIComponent(stage)}`)
      .then(r => r.json())
      .then(d => setCompletions(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId, stage])

  useEffect(() => { load() }, [load])

  const toggle = async (taskKey: string, isCompleted: boolean, completionId?: number) => {
    setToggling(prev => new Set(prev).add(taskKey))
    try {
      if (isCompleted && completionId) {
        const res = await fetch(`/api/tasks?id=${completionId}`, { method: 'DELETE' })
        if (res.ok) setCompletions(prev => prev.filter(c => c.task_key !== taskKey))
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_record_id: customerId, stage, task_key: taskKey }),
        })
        const d = await res.json()
        if (d.data) setCompletions(prev => [...prev.filter(c => c.task_key !== taskKey), d.data])
      }
    } catch {}
    finally { setToggling(prev => { const s = new Set(prev); s.delete(taskKey); return s }) }
  }

  if (tasks.length === 0) return null

  const completionMap = Object.fromEntries(completions.map(c => [c.task_key, c]))
  const done = tasks.filter(t => completionMap[t.key]).length

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400">VIỆC CẦN LÀM</p>
        <span className="text-xs font-semibold text-gray-500">{done}/{tasks.length}</span>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-400 rounded-full transition-all duration-300"
            style={{ width: `${tasks.length > 0 ? (done / tasks.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4 pb-5">
          <span className="crm-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {tasks.map(task => {
            const completion = completionMap[task.key]
            const isCompleted = !!completion
            const canDo      = canCompleteTask(task, userRole)
            const isToggling = toggling.has(task.key)

            return (
              <div key={task.key} className={`flex items-start gap-3 px-4 py-3 ${!canDo ? 'opacity-40' : ''}`}>
                <button
                  onClick={() => canDo && !isToggling && toggle(task.key, isCompleted, completion?.id)}
                  disabled={!canDo || isToggling}
                  className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-green-500 border-green-500'
                      : canDo
                        ? 'border-gray-300 active:border-blue-400'
                        : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {isToggling ? (
                    <span className="crm-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                  ) : isCompleted ? (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {task.label}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full leading-tight">
                      {task.role_badge}
                    </span>
                    {isCompleted && completion && (
                      <span className="text-[10px] text-green-600">
                        {completion.completed_by_name} · {new Date(completion.completed_at).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
