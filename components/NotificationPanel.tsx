'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

const TYPE_ICON: Record<string, string> = {
  quote_pending_approval: '📋',
  task_overdue:           '⚠️',
  warranty_expiring:      '🛡️',
}

function fmtRelative(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return 'Vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return `${Math.floor(diff / 86400)} ngày trước`
}

interface Props {
  unreadCount: number
  onCountChange: (n: number) => void
}

export function NotificationPanel({ unreadCount, onCountChange }: Props) {
  const [open,          setOpen]          = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const router   = useRouter()

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/notifications?limit=20')
      const json = await res.json()
      if (res.ok) {
        setNotifications(json.data ?? [])
        onCountChange(json.unread_count ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open) fetchNotifications()
  }

  const markOne = async (n: Notification) => {
    if (!n.read_at) {
      await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' })
      setNotifications(prev =>
        prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)
      )
      onCountChange(Math.max(0, unreadCount - 1))
    }
    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  const markAll = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    onCountChange(0)
  }

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
        aria-label="Thông báo"
      >
        <span className="text-xl leading-none">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Thông báo</span>
            {unreadCount > 0 && (
              <button
                onClick={markAll}
                className="text-xs text-blue-600 hover:underline"
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading && (
              <p className="text-center text-xs text-gray-400 py-6">Đang tải...</p>
            )}
            {!loading && notifications.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-6">Không có thông báo</p>
            )}
            {!loading && notifications.map(n => (
              <button
                key={n.id}
                onClick={() => markOne(n)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3 items-start ${!n.read_at ? 'bg-blue-50/40' : ''}`}
              >
                <span className="text-lg mt-0.5 shrink-0">{TYPE_ICON[n.type] ?? '🔔'}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${!n.read_at ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">{fmtRelative(n.created_at)}</p>
                </div>
                {!n.read_at && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
