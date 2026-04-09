/**
 * Test tạo 1 KH qua Lark batch_create để xem lỗi thật sự
 * Chạy: PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx tsx --env-file=.env.local scripts/test-import-customer.mts
 */

const LARK_API = 'https://open.larksuite.com/open-apis'

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

async function main() {
  const token = await getToken()
  const appToken = process.env.LARK_BASE_APP_TOKEN!
  const tableId  = 'tbl56uB4wSaACzgm' // TB01 Khách hàng

  const testRecord = {
    fields: {
      'Họ tên KH':           'Test Khách Hàng',
      'SĐT di động':         '0901234567',
      'Trạng thái pipeline': 'Lead mới',
      'Ngày liên hệ đầu':    Date.now(),
      'Email':               'test@example.com',
      'Địa chỉ ký HĐ':      '123 Lê Lợi, Q1, TPHCM',
      'Nguồn KH':            'Facebook',
      'Loại hình nhà':       'Nhà phố',
      'Nguồn nước':          'Nước máy',
      'Mức ưu tiên':         'Trung bình',
      'Giá trị báo giá (VNĐ)': 25000000,
      'Nội dung trao đổi':   'Khách test',
      'Người phụ trách':     'Nguyễn Văn Hùng',
    }
  }

  console.log('Gửi batch_create với 1 record test...')

  const res = await fetch(
    `${LARK_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [testRecord] }),
    }
  )

  const data = await res.json()
  console.log('HTTP status:', res.status)
  console.log('Lark response:', JSON.stringify(data, null, 2))
}

main().catch(err => { console.error('Lỗi:', err.message); process.exit(1) })
