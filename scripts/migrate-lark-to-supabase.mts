/**
 * Phase 7 — Migration script: LarkBase → Supabase
 *
 * Chạy 1 lần duy nhất để migrate toàn bộ dữ liệu hiện có.
 * Thứ tự: products → customers → quotes → orders → maintenance
 *
 * Chạy:
 *   PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx tsx --env-file=.env.local scripts/migrate-lark-to-supabase.mts
 *
 * Flags:
 *   --only=products,customers   Chỉ chạy các bảng chỉ định
 *   --dry-run                   In ra dữ liệu sẽ insert, không ghi vào DB
 */

import { createClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────────

const LARK_API      = 'https://open.larksuite.com/open-apis'
const APP_TOKEN     = process.env.LARK_BASE_APP_TOKEN!
const APP_ID        = process.env.LARK_APP_ID!
const APP_SECRET    = process.env.LARK_APP_SECRET!

const SUPA_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY!

const DRY_RUN       = process.argv.includes('--dry-run')
const ONLY_TABLES   = process.argv.find(a => a.startsWith('--only='))
  ?.replace('--only=', '').split(',') ?? null

// LarkBase Table IDs — sync với lib/lark/tables.ts
const TABLES = {
  CUSTOMERS:               'tbl56uB4wSaACzgm',
  PRODUCTS:                'tbl5ekXxzmCADqQw',
  QUOTES:                  'tblJi0l9GSDGgiFu',
  CONTRACTS:               'tbl2l6Z9vPaHfNHs',   // B2C (hợp đồng)
  COMMERCIAL_ORDERS:       'tbl47Uve7oTPQ3b0',   // Thương mại
  PROJECTS:                'tbl5zCezRWITxnXL',   // Dự án
  MAINTENANCE_PERIODIC:    'tbl6sFK3nDfFRtLN',
  MAINTENANCE_CONSTRUCTION:'tbl2XRs8cikrVZXL',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const supabase = createClient(SUPA_URL, SUPA_KEY)

let _larkToken: { token: string; expiresAt: number } | null = null

async function getLarkToken(): Promise<string> {
  if (_larkToken && _larkToken.expiresAt > Date.now() + 60_000) {
    return _larkToken.token
  }
  const res = await fetch(`${LARK_API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  })
  const data = await res.json()
  if (data.code !== 0) throw new Error(`Lark auth failed: ${data.msg}`)
  _larkToken = { token: data.tenant_access_token, expiresAt: Date.now() + data.expire * 1000 }
  return _larkToken.token
}

async function larkFetchAll(tableId: string): Promise<any[]> {
  const all: any[] = []
  let pageToken: string | undefined

  do {
    const token  = await getLarkToken()
    const params = new URLSearchParams({ page_size: '500' })
    if (pageToken) params.set('page_token', pageToken)

    const url = `${LARK_API}/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records?${params}`
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()

    if (data.code !== 0) throw new Error(`Lark list error (${tableId}): ${data.msg}`)
    all.push(...(data.data.items ?? []))
    pageToken = data.data.has_more ? data.data.page_token : undefined
  } while (pageToken)

  return all
}

function f(fields: Record<string, unknown>, key: string): string {
  const v = fields[key]
  if (!v) return ''
  if (Array.isArray(v)) return v.map((x: any) => x?.text ?? x).join(', ')
  if (typeof v === 'object' && v !== null && 'text' in v) return String((v as any).text ?? '')
  return String(v)
}

function fNum(fields: Record<string, unknown>, key: string): number {
  return Number(fields[key] ?? 0)
}

function fDate(fields: Record<string, unknown>, key: string): string | null {
  const v = fields[key]
  if (!v) return null
  const ms = Number(v)
  if (isNaN(ms) || ms === 0) return null
  return new Date(ms).toISOString().split('T')[0]
}

function fArr(fields: Record<string, unknown>, key: string): string[] {
  const v = fields[key]
  if (!v) return []
  if (Array.isArray(v)) return v.map((x: any) => x?.text ?? x?.value ?? String(x)).filter(Boolean)
  return [String(v)]
}

function log(msg: string) { console.log(`  ${msg}`) }
function warn(msg: string) { console.warn(`  ⚠️  ${msg}`) }
function section(msg: string) { console.log(`\n──── ${msg} ${'─'.repeat(50 - msg.length)}`) }

// ─── Build lookup maps ────────────────────────────────────────────────────────

async function buildProfileMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('profiles').select('id, full_name')
  if (error) throw error
  const map = new Map<string, string>()
  for (const p of data ?? []) {
    if (p.full_name) map.set(p.full_name.trim(), p.id)
  }
  log(`Profile map: ${map.size} entries`)
  return map
}

async function buildCustomerMap(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('customers').select('id, lark_record_id')
  if (error) throw error
  const map = new Map<string, number>()
  for (const c of data ?? []) {
    if (c.lark_record_id) map.set(c.lark_record_id, c.id)
  }
  return map
}

async function buildProductMap(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('products').select('id, lark_record_id')
  if (error) throw error
  const map = new Map<string, number>()
  for (const p of data ?? []) {
    if (p.lark_record_id) map.set(p.lark_record_id, p.id)
  }
  return map
}

async function buildQuoteMap(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('quotes').select('id, lark_record_id')
  if (error) throw error
  const map = new Map<string, number>()
  for (const q of data ?? []) {
    if (q.lark_record_id) map.set(q.lark_record_id, q.id)
  }
  return map
}

// ─── Migration functions ──────────────────────────────────────────────────────

async function migrateProducts() {
  section('PRODUCTS')
  const records = await larkFetchAll(TABLES.PRODUCTS)
  log(`Fetched ${records.length} records from LarkBase`)

  const rows = records.map(r => ({
    lark_record_id:  r.record_id,
    ma_sp:           f(r.fields, 'Mã SP'),
    ten_sp:          f(r.fields, 'Tên sản phẩm') || '(Chưa đặt tên)',
    phan_loai:       f(r.fields, 'Phân loại'),
    nhom_sp:         f(r.fields, 'Nhóm SP'),
    gia_niem_yet:    fNum(r.fields, 'Giá niêm yết (VNĐ)'),
    gia_chiet_khau:  fNum(r.fields, 'Giá chiết khấu'),
    gia_dai_ly:      fNum(r.fields, 'Giá đại lý'),
    gia_npp:         fNum(r.fields, 'Giá nhà phân phối'),
    hh_kd:           fNum(r.fields, '% Hoa hồng KD'),
    mo_ta:           f(r.fields, 'Mô tả') || null,
    anh_sp:          f(r.fields, 'Ảnh sản phẩm') || null,
    con_hang:        true,
  }))

  if (DRY_RUN) { console.log(rows.slice(0, 2)); return }

  const { error } = await supabase
    .from('products')
    .upsert(rows, { onConflict: 'lark_record_id' })
  if (error) throw error
  log(`✅ Upserted ${rows.length} products`)
}

async function migrateCustomers(profileMap: Map<string, string>) {
  section('CUSTOMERS')
  const records = await larkFetchAll(TABLES.CUSTOMERS)
  log(`Fetched ${records.length} records from LarkBase`)

  let unmapped = 0
  const rows = records.map(r => {
    const nptName = f(r.fields, 'Người phụ trách')
    const nptId   = nptName ? profileMap.get(nptName.trim()) : undefined
    if (nptName && !nptId) { warn(`nguoi_phu_trach not found: "${nptName}"`); unmapped++ }

    return {
      lark_record_id:      r.record_id,
      ho_ten:              f(r.fields, 'Họ tên KH') || '(Không tên)',
      sdt:                 f(r.fields, 'SĐT di động') || null,
      sdt_khac:            f(r.fields, 'SĐT khác') || null,
      email:               f(r.fields, 'Email') || null,
      ma_kh:               f(r.fields, 'Mã KH (tự đặt)') || null,
      dia_chi_hd:          f(r.fields, 'Địa chỉ ký HĐ') || null,
      dia_chi_ct:          f(r.fields, 'Địa chỉ công trình') || null,
      pipeline:            f(r.fields, 'Trạng thái pipeline') || 'Lead mới',
      nguoi_phu_trach:     nptId ?? null,
      khu_vuc:             f(r.fields, 'Khu vực') || null,
      nguon_kh:            f(r.fields, 'Nguồn KH') || null,
      doi_tac_gt:          f(r.fields, 'Đối tác giới thiệu') || null,
      loai_hinh_nha:       f(r.fields, 'Loại hình nhà') || null,
      nguon_nuoc:          f(r.fields, 'Nguồn nước') || null,
      san_pham_quan_tam:   fArr(r.fields, 'Sản phẩm quan tâm'),
      bao_gia:             fNum(r.fields, 'Giá trị báo giá (VNĐ)'),
      muc_uu_tien:         f(r.fields, 'Mức ưu tiên') || null,
      ngay_lien_he_dau:    fDate(r.fields, 'Ngày liên hệ đầu'),
      noi_dung:            f(r.fields, 'Nội dung trao đổi') || null,
      ly_do_tu_choi:       f(r.fields, 'Lý do từ chối') || null,
      nhom_dv:             f(r.fields, 'Nhóm dịch vụ') || null,
      tien_do_ct:          f(r.fields, 'Tiến độ công trình') || null,
    }
  })

  if (DRY_RUN) { console.log(rows.slice(0, 2)); return }

  // Upsert từng batch 100 để tránh timeout
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('customers').upsert(batch, { onConflict: 'lark_record_id' })
    if (error) throw error
    log(`  Batch ${Math.floor(i / BATCH) + 1}: ${batch.length} records`)
  }
  log(`✅ Upserted ${rows.length} customers (${unmapped} nguoi_phu_trach không khớp → NULL)`)
}

async function migrateQuotes(customerMap: Map<string, number>, profileMap: Map<string, string>) {
  section('QUOTES')
  const records = await larkFetchAll(TABLES.QUOTES)
  log(`Fetched ${records.length} records from LarkBase`)

  let unmappedKH = 0
  const rows = records.map(r => {
    // Tìm customer_id qua SĐT
    const sdt = f(r.fields, 'SĐT')
    // LarkBase quotes liên kết KH bằng tên, không phải record_id — cần tìm qua SĐT
    // customerMap là lark_record_id → id nên không dùng trực tiếp được
    // → bỏ qua liên kết cho đợt migration đầu, điền sau bằng script riêng

    const nptName = f(r.fields, 'Người phụ trách')
    const nptId   = nptName ? profileMap.get(nptName.trim()) : undefined

    const tong = fNum(r.fields, 'Tổng giá trị BG (VNĐ)')
    const ck   = fNum(r.fields, 'Chiết khấu (%)')

    return {
      lark_record_id:      r.record_id,
      ma_bao_gia:          f(r.fields, 'Mã báo giá') || null,
      nguoi_phu_trach:     nptId ?? null,
      phien_ban:           fNum(r.fields, 'Phiên bản') || 1,
      trang_thai:          f(r.fields, 'Trạng thái') || 'Mới tạo',
      tong_gia_tri:        tong,
      chiet_khau:          ck,
      gia_tri_sau_ck:      Math.round(tong * (1 - ck / 100)),
      kenh_tiep_nhan:      f(r.fields, 'Nguồn KH') || null,
      ghi_chu_ky_thuat:    f(r.fields, 'Ghi chú kỹ thuật') || null,
      ghi_chu_thuong_mai:  f(r.fields, 'Ghi chú thương mại') || null,
      ly_do_tu_choi:       f(r.fields, 'Lý do từ chối') || null,
      ma_hd_tham_chieu:    f(r.fields, 'Mã HĐ tham chiếu') || null,
      ket_qua_follow_up:   f(r.fields, 'Kết quả follow-up') || null,
      ngay_lap:            fDate(r.fields, 'Ngày lập BG'),
      ngay_het_han:        fDate(r.fields, 'Ngày hết hạn BG'),
      ngay_gui_kh:         fDate(r.fields, 'Ngày gửi KH'),
      ngay_follow_up:      fDate(r.fields, 'Ngày follow-up'),
    }
  })

  if (DRY_RUN) { console.log(rows.slice(0, 2)); return }

  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from('quotes').upsert(rows.slice(i, i + BATCH), { onConflict: 'lark_record_id' })
    if (error) throw error
  }
  log(`✅ Upserted ${rows.length} quotes`)
  log(`   ℹ️  customer_id chưa được điền — chạy link-quotes-to-customers.mts sau`)
}

async function migrateOrders(customerMap: Map<string, number>, profileMap: Map<string, string>) {
  section('ORDERS — B2C (Hợp đồng)')

  const contracts = await larkFetchAll(TABLES.CONTRACTS)
  log(`Fetched ${contracts.length} B2C contracts`)

  const b2cRows = contracts.map(r => {
    const nptName = f(r.fields, 'Người phụ trách')
    return {
      lark_record_id:    r.record_id,
      type:              'b2c',
      nguoi_phu_trach:   nptName ? profileMap.get(nptName.trim()) ?? null : null,
      trang_thai:        f(r.fields, 'Trạng thái HĐ') || 'Mới',
      ma_hd:             f(r.fields, 'Mã HĐ') || null,
      gia_tri_hd:        fNum(r.fields, 'Giá trị HĐ (VNĐ)'),
      gia_tri_gws:       fNum(r.fields, 'Giá trị GWS (VNĐ)'),
      hh_kinh_doanh:     fNum(r.fields, 'HH kinh doanh (VNĐ)'),
      san_pham:          fArr(r.fields, 'Sản phẩm chính'),
      ngay_ky:           fDate(r.fields, 'Ngày ký'),
      ngay_giao_dk:      fDate(r.fields, 'Ngày giao hàng DK'),
      dia_chi_ct:        f(r.fields, 'Địa chỉ công trình') || null,
      ghi_chu:           f(r.fields, 'Ghi chú') || null,
    }
  })

  section('ORDERS — Commercial (Thương mại)')
  const commercials = await larkFetchAll(TABLES.COMMERCIAL_ORDERS)
  log(`Fetched ${commercials.length} commercial orders`)

  const commercialRows = commercials.map(r => {
    const nptName = f(r.fields, 'Người phụ trách')
    return {
      lark_record_id:  r.record_id,
      type:            'commercial',
      nguoi_phu_trach: nptName ? profileMap.get(nptName.trim()) ?? null : null,
      trang_thai:      f(r.fields, 'Trạng thái đơn') || 'Mới',
      ma_don:          f(r.fields, 'Mã đơn hàng') || null,
      ngay_dat:        fDate(r.fields, 'Ngày đặt'),
      loai_khach:      f(r.fields, 'Loại khách') || null,
      ten_kh_tm:       f(r.fields, 'Tên khách hàng | Đại lý') || null,
      tinh_thanh:      f(r.fields, 'Tỉnh|Thành') || null,
      san_pham_text:   f(r.fields, 'Sản phẩm | Vật tư') || null,
      ma_sp_text:      f(r.fields, 'Mã SP|VT') || null,
      so_luong:        fNum(r.fields, 'Số lượng'),
      don_vi:          f(r.fields, 'Đơn vị') || null,
      don_gia:         fNum(r.fields, 'Đơn giá (VNĐ)'),
      tong_tien:       fNum(r.fields, 'Tổng tiền (VNĐ)'),
      phuong_thuc_tt:  f(r.fields, 'Phương thức TT') || null,
      ngay_giao_dk:    fDate(r.fields, 'Ngày giao hàng DK'),
      ngay_giao_thuc:  fDate(r.fields, 'Ngày giao thực'),
      ghi_chu:         f(r.fields, 'Ghi chú') || null,
    }
  })

  section('ORDERS — Project (Dự án)')
  const projects = await larkFetchAll(TABLES.PROJECTS)
  log(`Fetched ${projects.length} projects`)

  const projectRows = projects.map(r => {
    const nptName = f(r.fields, 'NV phụ trách')
    return {
      lark_record_id:   r.record_id,
      type:             'project',
      nguoi_phu_trach:  nptName ? profileMap.get(nptName.trim()) ?? null : null,
      trang_thai:       f(r.fields, 'Giai đoạn dự án') || 'Mới',
      ma_da:            f(r.fields, 'Mã dự án') || null,
      ten_da:           f(r.fields, 'Tên dự án') || null,
      chu_dau_tu:       f(r.fields, 'Chủ đầu tư') || null,
      tong_thau:        f(r.fields, 'Tổng thầu | Đơn vị mời thầu') || null,
      loai_da:          f(r.fields, 'Loại dự án') || null,
      quy_mo:           f(r.fields, 'Quy mô') || null,
      tinh_thanh:       f(r.fields, 'Tỉnh|Thành') || null,
      giai_doan:        f(r.fields, 'Giai đoạn dự án') || null,
      gia_tri_dt:       fNum(r.fields, 'Giá trị DT ước tính (VNĐ)'),
      gia_tri_hd:       fNum(r.fields, 'Giá trị HĐ ký (VNĐ)'),
      ngay_bao_gia:     fDate(r.fields, 'Ngày nộp thầu | Ngày báo giá'),
      ngay_du_kien_ky:  fDate(r.fields, 'Ngày dự kiến ký HĐ'),
      ngay_bt_tc:       fDate(r.fields, 'Ngày bắt đầu TC'),
      ngay_hoan_thanh:  fDate(r.fields, 'Ngày hoàn thành DK'),
      doi_tac_da:       f(r.fields, 'Đối tác tham gia') || null,
      ty_le_thang:      fNum(r.fields, 'Tỷ lệ thắng thầu (%)'),
      cong_no:          fNum(r.fields, 'Công nợ còn lại (VNĐ)'),
      ghi_chu:          f(r.fields, 'Ghi chú') || null,
    }
  })

  if (DRY_RUN) { console.log({ b2c: b2cRows[0], commercial: commercialRows[0], project: projectRows[0] }); return }

  const allOrders = [...b2cRows, ...commercialRows, ...projectRows]
  const BATCH = 100
  for (let i = 0; i < allOrders.length; i += BATCH) {
    const { error } = await supabase.from('orders').upsert(allOrders.slice(i, i + BATCH), { onConflict: 'lark_record_id' })
    if (error) throw error
  }
  log(`✅ Upserted ${allOrders.length} orders (${b2cRows.length} B2C, ${commercialRows.length} TM, ${projectRows.length} DA)`)
}

async function migrateMaintenance(customerMap: Map<string, number>, profileMap: Map<string, string>) {
  section('MAINTENANCE — Periodic (Bảo trì định kỳ)')
  const periodic = await larkFetchAll(TABLES.MAINTENANCE_PERIODIC)
  log(`Fetched ${periodic.length} records`)

  const periodicRows = periodic.map(r => {
    const nptName = f(r.fields, 'NV phụ trách')
    return {
      lark_record_id:   r.record_id,
      nv_phu_trach:     nptName ? profileMap.get(nptName.trim()) ?? null : null,
      ma_bddk:          f(r.fields, 'Mã dịch vụ') || null,
      san_pham_da_lap:  fArr(r.fields, 'Sản phẩm đã lắp'),
      dich_vu:          fArr(r.fields, 'Dịch vụ cần thực hiện'),
      vat_tu:           fArr(r.fields, 'Vật tư cần chuẩn bị'),
      chu_ky:           fNum(r.fields, 'Chu kỳ (tháng)'),
      lan_bd_gan_nhat:  fDate(r.fields, 'Lần BĐ gần nhất'),
      lan_bd_tiep_theo: fDate(r.fields, 'Lần BĐ tiếp theo'),
      trang_thai:       f(r.fields, 'Trạng thái') || 'Đang hoạt động',
      ghi_chu:          f(r.fields, 'Ghi chú') || null,
    }
  })

  section('MAINTENANCE — Construction (Lắp đặt công trình)')
  const construction = await larkFetchAll(TABLES.MAINTENANCE_CONSTRUCTION)
  log(`Fetched ${construction.length} records`)

  const constructionRows = construction.map(r => {
    const ktvName = f(r.fields, 'KTV phụ trách')
    return {
      lark_record_id:  r.record_id,
      ktv_phu_trach:   ktvName ? profileMap.get(ktvName.trim()) ?? null : null,
      ma_ct:           f(r.fields, 'Mã CT') || null,
      san_pham:        f(r.fields, 'Sản phẩm') || null,
      ngay_gh_thuc:    fDate(r.fields, 'Ngày GH thực'),
      ngay_nt:         fDate(r.fields, 'Ngày NT'),
      trang_thai:      f(r.fields, 'Trạng thái thi công') || 'Đang thi công',
      ghi_chu:         f(r.fields, 'Ghi chú thi công') || null,
    }
  })

  if (DRY_RUN) { console.log({ periodic: periodicRows[0], construction: constructionRows[0] }); return }

  if (periodicRows.length > 0) {
    const { error } = await supabase.from('maintenance_periodic').upsert(periodicRows, { onConflict: 'lark_record_id' })
    if (error) throw error
    log(`✅ Upserted ${periodicRows.length} periodic maintenance`)
  }
  if (constructionRows.length > 0) {
    const { error } = await supabase.from('maintenance_construction').upsert(constructionRows, { onConflict: 'lark_record_id' })
    if (error) throw error
    log(`✅ Upserted ${constructionRows.length} construction records`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log(' Phase 7 — LarkBase → Supabase Migration')
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (không ghi DB)' : '🚀 LIVE'}`)
  if (ONLY_TABLES) console.log(`  Only: ${ONLY_TABLES.join(', ')}`)
  console.log('═══════════════════════════════════════════════════════')

  const shouldRun = (name: string) => !ONLY_TABLES || ONLY_TABLES.includes(name)

  try {
  const profileMap  = await buildProfileMap()
  const customerMap = new Map<string, number>()
  const productMap  = new Map<string, number>()
    if (shouldRun('products'))     await migrateProducts()
    if (shouldRun('customers'))    await migrateCustomers(profileMap)

    // Rebuild maps sau khi upsert
    if (!DRY_RUN) {
      const cm = await buildCustomerMap()
      cm.forEach((v, k) => customerMap.set(k, v))
    }

    if (shouldRun('quotes'))       await migrateQuotes(customerMap, profileMap)
    if (shouldRun('orders'))       await migrateOrders(customerMap, profileMap)
    if (shouldRun('maintenance'))  await migrateMaintenance(customerMap, profileMap)

    console.log('\n✅ Migration hoàn tất!')
    console.log('\nViệc cần làm tiếp theo:')
    console.log('  1. Kiểm tra dữ liệu trên Supabase Dashboard')
    console.log('  2. Chạy migration 019 để link customer_id vào task_completions + payment_records')
    console.log('  3. Xác nhận số lượng records khớp với LarkBase')
  } catch (err) {
    console.error('\n❌ Migration thất bại:', err)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n❌ Unhandled error:', JSON.stringify(err, null, 2))
  console.error(err)
  process.exit(1)
})
