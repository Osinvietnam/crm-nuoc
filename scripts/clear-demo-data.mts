/**
 * Xóa toàn bộ dữ liệu demo khỏi các bảng LarkBase.
 * Chạy: PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx tsx --env-file=.env.local scripts/clear-demo-data.mts
 */

const LARK_API = 'https://open.larksuite.com/open-apis'

const TABLES_TO_CLEAR: Record<string, string> = {
  'TB01 Khách hàng':       'tbl56uB4wSaACzgm',
  'TB02 Hợp đồng':         'tbl2l6Z9vPaHfNHs',
  'TB03 Thanh toán':       'tbltKdcqLIWKX0JA',
  'TB07 Công trình':       'tbl2XRs8cikrVZXL',
  'TB08 Hoa hồng':         'tbl5DyW2XI2kmxmE',
  'TB09 Nhật ký LH':       'tbl1Z3ok59HWuakP',
  'TB10 Bán TM':           'tbl47Uve7oTPQ3b0',
  'TB11 Bảo dưỡng ĐK':     'tbl6sFK3nDfFRtLN',
  'TB12 Dự án':            'tbl5zCezRWITxnXL',
}

async function getToken(): Promise<string> {
  const res = await fetch(`${LARK_API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id:     process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET,
    }),
  })
  const data = await res.json() as { code: number; msg: string; tenant_access_token: string }
  if (data.code !== 0) throw new Error(`Auth failed: ${data.msg}`)
  return data.tenant_access_token
}

async function fetchAllRecordIds(token: string, tableId: string): Promise<string[]> {
  const appToken = process.env.LARK_BASE_APP_TOKEN!
  const ids: string[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({ page_size: '500' })
    if (pageToken) params.set('page_token', pageToken)

    const res = await fetch(
      `${LARK_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json() as {
      code: number; msg: string
      data: { items?: { record_id: string }[]; has_more: boolean; page_token?: string }
    }
    if (data.code !== 0) throw new Error(`listRecords error: ${data.msg}`)

    for (const item of data.data.items ?? []) ids.push(item.record_id)
    pageToken = data.data.has_more ? data.data.page_token : undefined
  } while (pageToken)

  return ids
}

async function batchDelete(token: string, tableId: string, ids: string[]): Promise<void> {
  const appToken = process.env.LARK_BASE_APP_TOKEN!
  const CHUNK = 500

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const res = await fetch(
      `${LARK_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_delete`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: chunk }),
      }
    )
    const data = await res.json() as { code: number; msg: string }
    if (data.code !== 0) throw new Error(`batchDelete error: ${data.msg}`)
    process.stdout.write(`  xóa ${Math.min(i + CHUNK, ids.length)}/${ids.length}...\r`)
  }
}

async function main() {
  if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET || !process.env.LARK_BASE_APP_TOKEN) {
    console.error('❌ Thiếu env: LARK_APP_ID, LARK_APP_SECRET, LARK_BASE_APP_TOKEN')
    process.exit(1)
  }

  console.log('🔐 Lấy token Lark...')
  const token = await getToken()
  console.log('✅ Token OK\n')

  for (const [name, tableId] of Object.entries(TABLES_TO_CLEAR)) {
    process.stdout.write(`📋 ${name} — đang đếm records...`)
    const ids = await fetchAllRecordIds(token, tableId)

    if (ids.length === 0) {
      console.log(`\r📋 ${name} — trống, bỏ qua.`)
      continue
    }

    console.log(`\r📋 ${name} — ${ids.length} records, đang xóa...`)
    await batchDelete(token, tableId, ids)
    console.log(`✅ ${name} — đã xóa ${ids.length} records.`)
  }

  console.log('\n🎉 Xong! Tất cả bảng demo đã được xóa sạch.')
}

main().catch(err => {
  console.error('\n❌ Lỗi:', err.message)
  process.exit(1)
})
