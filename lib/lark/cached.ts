/**
 * Cached wrappers around LarkBase read operations.
 * Uses Next.js `use cache` directive (Next.js 16+ Cache Components model).
 *
 * Cache behaviour:
 *   stale: 5 min → revalidate: 1 min → expire: 1 hour
 *
 * Tags (for on-demand invalidation after mutations):
 *   'lark-customers', 'lark-contracts', 'lark-products',
 *   'lark-orders', 'lark-maintenance', 'lark-quotes', 'lark-construction'
 */

import { cacheLife, cacheTag } from 'next/cache'
import { listAllRecords, getRecord, LarkRecord } from './client'
import { TABLES } from './tables'

// Table ID → cache tag
const TABLE_TAG: Record<string, string> = {
  [TABLES.CUSTOMERS]:        'lark-customers',
  [TABLES.CONTRACTS]:        'lark-contracts',
  [TABLES.PAYMENTS]:         'lark-payments',
  [TABLES.PRODUCTS]:         'lark-products',
  [TABLES.CONSTRUCTION]:     'lark-construction',
  [TABLES.PERIODIC_SERVICE]: 'lark-maintenance',
  [TABLES.COMMERCIAL]:       'lark-commercial',
  [TABLES.QUOTES]:           'lark-quotes',
  [TABLES.PROJECTS]:         'lark-projects',
  [TABLES.CONTACT_LOG]:      'lark-contact-log',
  [TABLES.STAFF]:            'lark-staff',
  [TABLES.PARTNERS]:         'lark-partners',
  [TABLES.DISTRIBUTORS]:     'lark-distributors',
  [TABLES.COMMISSIONS]:      'lark-commissions',
}

/**
 * Cached version of listAllRecords.
 * Cache key = (tableId, filter) — different filters = separate cache entries.
 */
export async function cachedListAllRecords(
  tableId: string,
  filter?: string,
): Promise<LarkRecord[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(TABLE_TAG[tableId] ?? `lark-${tableId}`)
  return listAllRecords(tableId, filter)
}

/**
 * Cached version of getRecord.
 */
export async function cachedGetRecord(
  tableId: string,
  recordId: string,
): Promise<LarkRecord> {
  'use cache'
  cacheLife('minutes')
  cacheTag(TABLE_TAG[tableId] ?? `lark-${tableId}`)
  cacheTag(`lark-record-${recordId}`)
  return getRecord(tableId, recordId)
}
