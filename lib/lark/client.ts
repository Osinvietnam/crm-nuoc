const LARK_API = 'https://open.larksuite.com/open-apis'

// Module-level token cache (persists across requests in a warm serverless instance)
let _tokenCache: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  const now = Date.now()
  if (_tokenCache && _tokenCache.expiresAt > now + 60_000) {
    return _tokenCache.token
  }

  const res = await fetch(`${LARK_API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET,
    }),
    cache: 'no-store',
  })

  const data = await res.json()
  if (data.code !== 0) throw new Error(`Lark auth failed: ${data.msg}`)

  _tokenCache = {
    token: data.tenant_access_token,
    expiresAt: now + data.expire * 1000,
  }
  return _tokenCache.token
}

function appToken() {
  const t = process.env.LARK_BASE_APP_TOKEN
  if (!t) throw new Error('LARK_BASE_APP_TOKEN not set')
  return t
}

export interface LarkRecord {
  record_id: string
  fields: Record<string, unknown>
}

export interface ListOptions {
  pageSize?: number
  pageToken?: string
  filter?: string
  sort?: Array<{ field_name: string; desc?: boolean }>
}

export interface ListResult {
  items: LarkRecord[]
  hasMore: boolean
  pageToken?: string
  total: number
}

export async function listRecords(tableId: string, options: ListOptions = {}): Promise<ListResult> {
  const token = await getToken()
  const params = new URLSearchParams()
  if (options.pageSize)  params.set('page_size', String(options.pageSize))
  if (options.pageToken) params.set('page_token', options.pageToken)
  if (options.filter)    params.set('filter', options.filter)

  const url = `${LARK_API}/bitable/v1/apps/${appToken()}/tables/${tableId}/records?${params}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const data = await res.json()
  if (data.code !== 0) throw new Error(`Lark listRecords error: ${data.msg}`)

  return {
    items:     data.data.items ?? [],
    hasMore:   data.data.has_more ?? false,
    pageToken: data.data.page_token,
    total:     data.data.total ?? 0,
  }
}

// Fetch ALL records across pages (use carefully for large tables)
export async function listAllRecords(tableId: string, filter?: string): Promise<LarkRecord[]> {
  const all: LarkRecord[] = []
  let pageToken: string | undefined

  do {
    const result = await listRecords(tableId, { pageSize: 500, pageToken, filter })
    all.push(...result.items)
    pageToken = result.hasMore ? result.pageToken : undefined
  } while (pageToken)

  return all
}

export async function getRecord(tableId: string, recordId: string): Promise<LarkRecord> {
  const token = await getToken()
  const url = `${LARK_API}/bitable/v1/apps/${appToken()}/tables/${tableId}/records/${recordId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const data = await res.json()
  if (data.code !== 0) throw new Error(`Lark getRecord error: ${data.msg}`)
  return data.data.record
}

export async function createRecord(
  tableId: string,
  fields: Record<string, unknown>
): Promise<LarkRecord> {
  const token = await getToken()
  const res = await fetch(
    `${LARK_API}/bitable/v1/apps/${appToken()}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      cache: 'no-store',
    }
  )

  const data = await res.json()
  if (data.code !== 0) throw new Error(`Lark createRecord error: ${data.msg}`)
  return data.data.record
}

export async function updateRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<LarkRecord> {
  const token = await getToken()
  const res = await fetch(
    `${LARK_API}/bitable/v1/apps/${appToken()}/tables/${tableId}/records/${recordId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      cache: 'no-store',
    }
  )

  const data = await res.json()
  if (data.code !== 0) throw new Error(`Lark updateRecord error: ${data.msg}`)
  return data.data.record
}

export async function batchCreateRecords(
  tableId: string,
  records: Record<string, unknown>[]
): Promise<LarkRecord[]> {
  const token = await getToken()
  const res = await fetch(
    `${LARK_API}/bitable/v1/apps/${appToken()}/tables/${tableId}/records/batch_create`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: records.map(fields => ({ fields })) }),
      cache: 'no-store',
    }
  )
  const data = await res.json()
  if (data.code !== 0) throw new Error(`Lark batchCreate error: ${data.msg}`)
  return data.data.records ?? []
}

export async function batchUpdateRecords(
  tableId: string,
  records: { record_id: string; fields: Record<string, unknown> }[]
): Promise<LarkRecord[]> {
  const token = await getToken()
  const res = await fetch(
    `${LARK_API}/bitable/v1/apps/${appToken()}/tables/${tableId}/records/batch_update`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
      cache: 'no-store',
    }
  )
  const data = await res.json()
  if (data.code !== 0) throw new Error(`Lark batchUpdate error: ${data.msg}`)
  return data.data.records ?? []
}

// Helper: parse Lark date fields (milliseconds timestamp)
export function parseLarkDate(val: unknown): Date | null {
  if (!val) return null
  const n = Number(val)
  if (isNaN(n)) return null
  // Lark stores dates as ms timestamps
  return new Date(n)
}

// Helper: parse text field (may be string or array)
export function parseLarkText(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return val.map((v: any) => v?.text ?? v).join(', ')
  return String(val)
}
