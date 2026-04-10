/**
 * In-memory TTL cache for LarkBase read operations.
 * Cache duration: 5 minutes. Invalidated explicitly after mutations.
 */

import { listAllRecords, getRecord, LarkRecord } from './client'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  data: T
  expiry: number
}

const listCache = new Map<string, CacheEntry<LarkRecord[]>>()
const recordCache = new Map<string, CacheEntry<LarkRecord>>()

export async function cachedListAllRecords(
  tableId: string,
  filter?: string,
): Promise<LarkRecord[]> {
  const key = `${tableId}:${filter ?? ''}`
  const now = Date.now()
  const entry = listCache.get(key)
  if (entry && entry.expiry > now) return entry.data

  const data = await listAllRecords(tableId, filter)
  listCache.set(key, { data, expiry: now + CACHE_TTL_MS })
  return data
}

export async function cachedGetRecord(
  tableId: string,
  recordId: string,
): Promise<LarkRecord> {
  const key = `${tableId}:${recordId}`
  const now = Date.now()
  const entry = recordCache.get(key)
  if (entry && entry.expiry > now) return entry.data

  const data = await getRecord(tableId, recordId)
  recordCache.set(key, { data, expiry: now + CACHE_TTL_MS })
  return data
}

/**
 * Invalidate cache entries for a given tableId (or all if omitted).
 * Call after mutations (create/update/delete) in API routes.
 */
export function invalidateCache(tableId?: string): void {
  if (tableId) {
    for (const key of listCache.keys()) {
      if (key.startsWith(`${tableId}:`)) listCache.delete(key)
    }
    for (const key of recordCache.keys()) {
      if (key.startsWith(`${tableId}:`)) recordCache.delete(key)
    }
  } else {
    listCache.clear()
    recordCache.clear()
  }
}
