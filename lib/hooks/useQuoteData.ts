'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Quote } from '@/app/api/lark/quotes/_mappers'

export function isDueForFollowUp(q: Quote): boolean {
  if (!q.ngay_follow_up) return false
  if (['Chấp nhận', 'Từ chối'].includes(q.trang_thai)) return false
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
  return q.ngay_follow_up <= endOfToday.getTime()
}

export function useQuoteData() {
  const [data,    setData]    = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [total,   setTotal]   = useState(0)

  const fetchPage = useCallback(async (pg: number) => {
    if (pg === 1) setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/lark/quotes?pageSize=30&page=${pg}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const newData: Quote[] = json.data ?? []
      setData(prev => pg === 1 ? newData : [...prev, ...newData])
      setHasMore(json.meta?.hasMore ?? false)
      setTotal(json.meta?.total ?? 0)
      setPage(pg)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPage(1) }, [fetchPage])

  const reload   = useCallback(() => fetchPage(1), [fetchPage])
  const loadMore = useCallback(() => { if (hasMore) fetchPage(page + 1) }, [fetchPage, hasMore, page])

  return { data, setData, loading, error, reload, loadMore, hasMore, total }
}
