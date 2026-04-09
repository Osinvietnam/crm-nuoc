/**
 * Import 120 KH trực tiếp từ file Excel vào Lark, bypass app.
 * Chạy: PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx tsx --env-file=.env.local scripts/import-customers-xlsx.mts
 */

import { readFileSync } from 'fs'
import { read, utils } from 'xlsx'

const LARK_API  = 'https://open.larksuite.com/open-apis'
const TABLE_ID  = 'tbl56uB4wSaACzgm'
const XLSX_FILE = 'public/mau_120_khach_hang.xlsx'
const CHUNK     = 50

const COL_MAP: Record<string, string> = {
  'Họ tên KH':       'ho_ten',
  'SĐT':             'sdt',
  'Email':           'email',
  'Địa chỉ HĐ':      'dia_chi_hd',
  'Địa chỉ CT':      'dia_chi_ct',
  'Pipeline':        'pipeline',
  'Nguồn KH':        'nguon_kh',
  'Loại hình nhà':   'loai_hinh_nha',
  'Nguồn nước':      'nguon_nuoc',
  'Mức ưu tiên':     'muc_uu_tien',
  'Báo giá (VNĐ)':   'bao_gia',
  'Nội dung':        'noi_dung',
  'Người phụ trách': 'nguoi_phu_trach',
}

async function getToken(): Promise<string> {
  const res = await fetch(`${LARK_API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET }),
  })
  const data = await res.json() as { code: number; msg: string; tenant_access_token: string }
  if (data.code !== 0) throw new Error(`Auth: ${data.msg}`)
  return data.tenant_access_token
}

async function batchCreate(token: string, records: Record<string, unknown>[]): Promise<number> {
  const res = await fetch(
    `${LARK_API}/bitable/v1/apps/${process.env.LARK_BASE_APP_TOKEN}/tables/${TABLE_ID}/records/batch_create`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: records.map(fields => ({ fields })) }),
    }
  )
  const data = await res.json() as { code: number; msg: string; data?: { records: unknown[] } }
  if (data.code !== 0) throw new Error(`Lark batch_create: ${data.msg}`)
  return data.data?.records?.length ?? 0
}

async function main() {
  console.log(`📂 Đọc file ${XLSX_FILE}...`)
  const wb = read(readFileSync(XLSX_FILE))
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  console.log(`   ${rawRows.length} dòng tìm thấy`)

  const records = rawRows
    .map(row => {
      const mapped: Record<string, string | number> = {}
      for (const [header, key] of Object.entries(COL_MAP)) {
        const v = String(row[header] ?? '').trim()
        mapped[key] = key === 'bao_gia' ? (v ? Number(v.replace(/\D/g, '')) : 0) : v
      }
      return mapped
    })
    .filter(r => r.ho_ten && r.sdt)
    .map(r => {
      const fields: Record<string, unknown> = {
        'Họ tên KH':           r.ho_ten,
        'SĐT di động':         r.sdt,
        'Trạng thái pipeline': r.pipeline || 'Lead mới',
        'Ngày liên hệ đầu':    Date.now(),
      }
      if (r.email)           fields['Email'] = r.email
      if (r.dia_chi_hd)      fields['Địa chỉ ký HĐ'] = r.dia_chi_hd
      if (r.dia_chi_ct)      fields['Địa chỉ công trình'] = r.dia_chi_ct
      if (r.nguon_kh)        fields['Nguồn KH'] = r.nguon_kh
      if (r.loai_hinh_nha)   fields['Loại hình nhà'] = r.loai_hinh_nha
      if (r.nguon_nuoc)      fields['Nguồn nước'] = r.nguon_nuoc
      if (r.muc_uu_tien)     fields['Mức ưu tiên'] = r.muc_uu_tien
      if (r.bao_gia)         fields['Giá trị báo giá (VNĐ)'] = r.bao_gia
      if (r.noi_dung)        fields['Nội dung trao đổi'] = r.noi_dung
      if (r.nguoi_phu_trach) fields['Người phụ trách'] = r.nguoi_phu_trach
      return fields
    })

  console.log(`✅ ${records.length} records hợp lệ, bắt đầu import...\n`)

  const token = await getToken()
  let created = 0

  for (let i = 0; i < records.length; i += CHUNK) {
    const batch = records.slice(i, i + CHUNK)
    const n = await batchCreate(token, batch)
    created += n
    console.log(`  batch ${Math.floor(i / CHUNK) + 1}: +${n} records (tổng: ${created})`)
  }

  console.log(`\n🎉 Xong! Đã tạo ${created} khách hàng trên Lark.`)
}

main().catch(err => { console.error('\n❌ Lỗi:', err.message); process.exit(1) })
