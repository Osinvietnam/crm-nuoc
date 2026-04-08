'use client'

import { useRef, useState, useCallback } from 'react'

const THRESHOLD = 72   // px pulled before releasing triggers refresh
const MAX_PULL  = 100  // max visual drag distance

interface PullState {
  pulling: boolean
  distance: number
  refreshing: boolean
}

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const state    = useRef<PullState>({ pulling: false, distance: 0, refreshing: false })
  const startY   = useRef(0)
  const [dist, setDist]        = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement
    if (el.scrollTop > 0) return           // only trigger at top
    state.current.pulling = true
    startY.current = e.touches[0].clientY
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!state.current.pulling || state.current.refreshing) return
    const delta = Math.max(0, e.touches[0].clientY - startY.current)
    const clamped = Math.min(delta * 0.5, MAX_PULL)  // rubber-band feel
    state.current.distance = clamped
    if (clamped > 0) setDist(clamped)
  }, [])

  const onTouchEnd = useCallback(async () => {
    if (!state.current.pulling) return
    state.current.pulling = false
    const d = state.current.distance
    state.current.distance = 0
    setDist(0)
    if (d >= THRESHOLD && !state.current.refreshing) {
      state.current.refreshing = true
      setRefreshing(true)
      try { await onRefresh() } finally {
        state.current.refreshing = false
        setRefreshing(false)
      }
    }
  }, [onRefresh])

  return { dist, refreshing, onTouchStart, onTouchMove, onTouchEnd }
}

export function PullIndicator({ dist, refreshing }: { dist: number; refreshing: boolean }) {
  const visible = dist > 4 || refreshing
  if (!visible) return null
  const progress = Math.min(dist / 72, 1)
  return (
    <div
      className="flex items-center justify-center gap-2 text-blue-500 text-xs font-medium overflow-hidden transition-all"
      style={{ height: refreshing ? 36 : dist * 0.5 }}
    >
      {refreshing ? (
        <><span className="crm-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /><span>Đang làm mới...</span></>
      ) : (
        <span style={{ opacity: progress }}>{progress >= 1 ? '↑ Thả để làm mới' : '↓ Kéo để làm mới'}</span>
      )}
    </div>
  )
}
