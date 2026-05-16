/**
 * Simple in-memory rate limiter for server-side API routes.
 * Resets per worker instance (not shared across instances — acceptable for basic abuse prevention).
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

/**
 * @param key      Unique key (e.g. `${userId}:create_user` or `${ip}:login`)
 * @param limit    Max requests allowed in the window
 * @param windowMs Time window in milliseconds (default: 60_000 = 1 minute)
 * @returns true if request is allowed, false if rate-limited
 */
export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

/** Clear entries older than their reset time (call periodically if needed) */
export function pruneRateLimit(): void {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}
