# WORK LOG — CRM Máy Lọc Nước
> Ghi chép tiến độ từng phase để tra cứu nhanh, tránh làm lại việc đã xong.
> Cập nhật lần cuối: **2026-04-15**

---

## Tổng quan kiến trúc

| Lớp | Công nghệ | Ghi chú |
|-----|-----------|---------|
| Frontend | Next.js 16.2.2 App Router + TypeScript + Tailwind CSS v4 | PWA mobile-first |
| Auth + DB | Supabase (Singapore region) | RLS đầy đủ, service role cho admin |
| Sync | N8N self-host tại `https://app.sync.io.vn` | Nightly delta sync → LarkBase |
| Deploy | Vercel → `https://crm-nuoc.vercel.app` | Auto-deploy từ `main` branch |
| Legacy | LarkBase (13 bảng TB01-TB13) | Chỉ còn nhận sync từ N8N, không ghi trực tiếp |

---

## Phase 1 — Khởi tạo & Auth
**Trạng thái:** ✅ Hoàn thành

### Đã làm
- Khởi tạo Next.js App Router + Tailwind CSS v4 + TypeScript
- Supabase auth flow: login, forgot password, reset password
- Dashboard layout: header (avatar + tên + role), bottom nav (role-based menu), safe area insets iPhone
- `lib/supabase/client.ts` + `server.ts` — client/server Supabase helpers với `flowType: 'pkce'`
- `profiles` table — 8 roles: admin, ceo, tech_lead, accountant, sales, tech, logistics, partner
- Custom CSS: `nav-safe`, `content-safe`, `sheet-safe`, `crm-spinner`, `scrollbar-none`
- Trang `profile/page.tsx` — xem/sửa thông tin cá nhân

### Files chính
- `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
- `app/dashboard/layout.tsx` — layout wrapper toàn app
- `app/dashboard/profile/page.tsx`
- `lib/supabase/client.ts`, `lib/supabase/server.ts`

---

## Phase 2 — Quản lý Khách hàng (LarkBase era)
**Trạng thái:** ✅ Hoàn thành (sau Phase 7 chuyển sang Supabase)

### Đã làm
- Màn hình danh sách KH: tìm kiếm, filter pipeline, phân trang, kéo-để-làm-mới
- Màn hình chi tiết KH: InfoRow fields, pipeline selector, quote history, contact log
- API route `/api/lark/customers` — CRUD qua LarkBase TB01
- Pipeline stages 10 bước: Lead mới → ... → Bảo trì → Lost
- Auto-transition: tạo báo giá → pipeline = 'Báo giá'; quote chấp nhận → 'Chốt HĐ'
- 4 nguồn KH: Referral, Online, Walk-in, Cold call + thêm sau Phase 5

### SQL migrations liên quan
- `001_contract_customer_links.sql` — link TB02↔TB01
- `003_quote_customer_links.sql` — link báo giá↔KH

---

## Phase 3 — Sản phẩm & Báo giá
**Trạng thái:** ✅ Hoàn thành (sau Phase 7 chuyển sang Supabase)

### Đã làm
- **Sản phẩm** (`/dashboard/products`): danh sách, filter loại/nhóm, thêm/sửa, import Excel, upload ảnh
- **Báo giá** (`/dashboard/orders` tab Báo giá + `/dashboard/orders/quote/[id]`):
  - Tạo báo giá với quote items (stepper +/-)
  - Duplicate báo giá (tạo version mới cùng KH)
  - Follow-up date, status: Nháp → Đã gửi → Chấp nhận → Từ chối
- API: `/api/lark/products`, `/api/lark/quotes`, `/api/lark/quotes/duplicate`

### SQL migrations liên quan
- Không có migration riêng (dùng LarkBase TB06 + quote_customer_links)

---

## Phase 4 — Đơn hàng (3 loại)
**Trạng thái:** ✅ Hoàn thành (sau Phase 7 chuyển sang Supabase)

### Đã làm
- **B2C — Hợp đồng** (`/dashboard/orders/contract/[id]`):
  - Thông tin HĐ: giá trị, GWS, sản phẩm, địa chỉ CT, ngày ký/giao
  - Hoa hồng: `hh_phan_tram` → tự tính `hh_kinh_doanh`; đánh dấu đã trả
  - Auto-create `maintenance_construction` khi trạng thái = 'Đang thi công'
  - Khi 'Hoàn thành' → pipeline KH = 'Bảo hành'
- **Thương mại** (`/dashboard/orders/commercial/[id]`): B2B/đại lý
- **Dự án** (`/dashboard/orders/project/[id]`): B2B quy mô lớn, giai đoạn, tỷ lệ thắng
- Tab bar trên `/dashboard/orders`: Báo giá | Hợp đồng | Thương mại | Dự án

### SQL migrations liên quan
- `002_construction_contract_links.sql` — link TB07↔TB02

---

## Phase 5 — Quy trình vận hành (Checklist + KPI + Thanh toán)
**Trạng thái:** ✅ Backend hoàn thành | ⚠️ UI chưa tích hợp vào trang

### Đã làm — Backend
- **Task checklist** per pipeline stage (9 stages × 3-7 tasks = ~38 tasks tổng)
  - `lib/tasks/checklist.ts` — STAGE_TASKS định nghĩa đầy đủ, role_badge, roles_can_complete
  - `app/api/tasks/route.ts` — GET/POST/DELETE task completions (upsert by unique key)
- **KPI targets** per nhân viên per tháng
  - `app/api/admin/kpi/route.ts` — admin/CEO set target (upsert + audit log)
  - `app/api/kpi/me/route.ts` — GET target + actual (revenue từ payment_records)
- **Thanh toán 3 đợt** (60% / 35% / 5%)
  - `app/api/payments/route.ts` — CRUD với sync sang LarkBase TB03
  - LarkBase PAYMENTS table cần tạo thủ công các fields (xem plan Phase 5)

### Chưa làm — UI
- Section "Checklist công việc" trong `customers/[id]/page.tsx`
- Section "Thanh toán 3 đợt" trong `customers/[id]/page.tsx` (chỉ khi stage ≥ Chốt HĐ)
- KPI card trong `staff/page.tsx` (admin/CEO xem KPI từng nhân viên)

### SQL migrations
- `009_task_completions.sql` — `UNIQUE(customer_record_id, stage, task_key)`
- `010_kpi_targets.sql` — `UNIQUE(user_id, month, year)`
- `011_payment_records.sql` — 3 đợt TT, mirror LarkBase TB03

---

## Phase 6 — Bảo trì & Lịch
**Trạng thái:** ✅ Hoàn thành (sau Phase 7 chuyển sang Supabase)

### Đã làm
- **Bảo trì lắp đặt** (`/dashboard/maintenance` tab Lắp đặt + `construction/[id]`):
  - Timeline: Ngày GH dự kiến, Ngày GH thực, Ngày TC xong, Ngày NT
  - Auto-create `maintenance_periodic` khi 'Nghiệm thu hoàn thành' (chu kỳ 6 tháng)
  - `ngay_can_cs` + `ngay_het_bh` là GENERATED ALWAYS columns
- **Bảo trì định kỳ** (`/dashboard/maintenance` tab Định kỳ + `periodic/[id]`):
  - Xem lịch bảo dưỡng, cập nhật `lan_bd_gan_nhat` → tự tính `lan_bd_tiep_theo`
  - Màu sắc urgency theo số ngày còn lại
- **Lịch** (`/dashboard/calendar`): tháng/năm, hiển thị maintenance events theo ngày
- API: `/api/lark/maintenance`, `/api/calendar`

---

## Phase 7 — Migration LarkBase → Supabase
**Trạng thái:** ✅ Hoàn thành (commit chính: `ac50273`)

### Đã làm

#### Bước 1 — Schema Supabase (19 migrations)
Tạo đầy đủ bảng Supabase mirror toàn bộ LarkBase:
- `012_auth_helpers.sql` — `get_my_role()` + `get_my_khu_vuc()` SECURITY DEFINER helpers
- `013_customers.sql` — customers với RLS granular by role
- `014_products.sql` — products (read all, write admin/ceo)
- `015_quotes.sql` + `quote_items` — với RLS ownership check
- `016_orders.sql` — unified type='b2c'|'commercial'|'project'
- `017_maintenance.sql` — construction + periodic với GENERATED columns
- `018_pipeline_history.sql` — immutable log, insert qua DB trigger
- `019_update_existing_tables.sql` — thêm columns, fix policies

#### Bước 2 — Migration script
- `scripts/migrate-lark-to-supabase.mts` — đọc LarkBase, insert vào Supabase
- Đã chạy thành công, data được copy sang

#### Bước 3+4 — Rewrite API routes
Tất cả `/api/lark/*` routes giữ URL cũ nhưng backend chuyển sang Supabase:
- `app/api/lark/customers/route.ts` + `[id]/route.ts`
- `app/api/lark/products/_mapper.ts` + `route.ts` + `[id]/route.ts`
- `app/api/lark/quotes/_mappers.ts` + `route.ts` + `[id]/route.ts`
- `app/api/lark/orders/_mappers.ts` + `route.ts` + contract/commercial/project `[id]/route.ts`
- `app/api/lark/maintenance/_mappers.ts` + `route.ts` + construction/periodic `[id]/route.ts`
- `app/api/dashboard/stats/route.ts` — stats từ Supabase với RLS

#### Bước 5 — N8N nightly sync
- `scripts/n8n-sync-workflow.json` — import vào N8N
- Cron 2AM, delta 25h, 4 bảng: customers, b2c orders, construction, periodic
- Pattern: Supabase REST → map → IF lark_record_id → PUT / POST + patch ID về
- Env vars N8N: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LARK_BASE_APP_TOKEN`, `LARK_TENANT_ACCESS_TOKEN`

#### Bước 6 — Cleanup
- `lib/lark/cached.ts` **ĐÃ XÓA** (TTL cache cũ không còn dùng)
- `app/api/lark/quotes/duplicate/route.ts` rewrite sang Supabase hoàn toàn
- `app/api/admin/users/[id]/offboard/route.ts` rewrite bỏ LarkBase calls

#### Security Audit (2026-04-14)
Critical + High issues đã fix:
- C1: Drop đúng policy cũ (3 bảng 009/010/011)
- C2: profiles bật RLS + policies
- C3: system_config write restrict admin/ceo only
- C4: audit_logs insert — chỉ service role
- H1: `flowType: 'implicit'` → `'pkce'`
- H2: Error messages generic `'Lỗi server'`
- H3: quote_items policies restrict by user

### Routes còn dùng LarkBase trực tiếp (chưa rewrite)
| Route | Lý do giữ lại |
|-------|--------------|
| `app/api/payments/route.ts` | Sync payment sang LarkBase TB03 |
| `app/api/calendar/route.ts` | Đọc lịch từ LarkBase |
| `app/api/lark/customers/import/route.ts` | Bulk import KH |
| `app/api/lark/products/import/route.ts` | Import sản phẩm từ Excel |
| `app/api/lark/products/[id]/image/route.ts` | Upload ảnh SP |

---

## Phase 8 — Tài chính
**Trạng thái:** ✅ Hoàn thành

### Đã làm

#### SQL (chạy thủ công trên Supabase Dashboard)
- Migration 020: bảng `expenses` — chi phí hoạt động theo tháng (6 categories)
- Migration 021: bảng `assets` — tài sản + khấu hao tuyến tính
- Migration 022: thêm `hh_phan_tram`, `hh_kinh_doanh`, `hh_da_tra`, `hh_ngay_tra` vào `orders`

#### API routes
- `app/api/finance/expenses/route.ts` — GET/POST/PATCH/DELETE, upsert `onConflict: category,thang,nam`
- `app/api/finance/assets/route.ts` — CRUD + `calcDepreciation()` helper
- `app/api/finance/report/route.ts` — P&L: doanh_thu − opex − hoa_hong − khau_hao
- `app/api/finance/commissions/route.ts` — GET pending commissions, PATCH batch mark paid
- `app/api/lark/orders/contract/[id]/route.ts` — thêm fields hoa hồng vào PATCH

#### UI — `app/dashboard/finance/page.tsx`
5 tabs theo role:
- **Tổng quan**: P&L card gradient, biểu đồ 6 tháng, alert hoa hồng + công nợ
- **Chi phí**: nhập/sửa chi phí theo 6 category
- **Hoa hồng**: checkbox batch mark paid
- **Công nợ**: danh sách payment_records chưa trả, màu aging (>30d đỏ)
- **Tài sản**: thêm tài sản, ProgressRow khấu hao

#### Dashboard stats
Thêm 3 chỉ số vào `DashboardStats` + `stats/route.ts`:
- `hoa_hong_chua_tra` — tổng hoa hồng B2C chưa trả
- `khau_hao_thang` — tổng khấu hao tháng hiện tại
- `cong_no_qua_han` — tổng công nợ quá hạn

#### Menu nav
Thêm Tài chính vào menu: admin, ceo, accountant, sales

---

## Phase 9 — Responsive UI & UX
**Trạng thái:** ✅ Hoàn thành (2 commits: `524de8c`, `5118b9b`)

### Audit trước khi làm
File: `RESPONSIVE_AUDIT_2026-04-15.md`
- 19 màn hình scan, 38 issues (4🔴 22🟡 12🟢)
- Điểm trước: Mobile 7/10 | Tablet 5/10 | Desktop 4/10

### Đã làm

#### Bước 1 — CSS classes & Touch targets
- `globals.css`: định nghĩa `crm-input`, `crm-btn-primary`, `crm-btn-secondary`, `crm-card` trong `@layer components` (fix finance page broken styling)
- Stepper `−`/`+` buttons: `w-5 h-5` (20px) → `w-8 h-8` (32px) trong 3 files
- Action buttons: `py-1.5 px-3` → `py-2 px-4` cho Cập nhật/Tạo mới trên 7 detail pages
- Logout button: `py-1.5` → `py-2`

#### Bước 2 — Layout container (1 file, cover tất cả 14 pages)
- `layout.tsx`: bọc `{children}` trong `<div className="max-w-2xl mx-auto w-full">`
- Bottom nav: thêm `max-w-2xl mx-auto` để centered trên desktop

#### Bước 3 — Input consistency
- Search inputs `py-2.5` → `py-3` (customers, orders, maintenance)
- Finance month nav: `w-8 h-8` → `w-10 h-10`
- Profile form inputs + buttons: `py-2.5` → `py-3`
- Admin/Staff form elements: `py-2.5` → `py-3`

#### Bước 4 — Responsive grids
- Dashboard KPI: `grid-cols-2` → `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`

#### Bước 5 — Desktop Sidebar
- `layout.tsx` hoàn toàn rewrite thành 2-column structure:
  - **Sidebar** `hidden lg:flex`: cố định `w-56`, user info + menu dọc + logout
  - **Header** `lg:hidden`: chỉ hiện trên mobile
  - **Bottom nav** `lg:hidden`: chỉ hiện trên mobile
  - **Main area** `lg:ml-56`: nhường 224px cho sidebar
  - Nav label: `text-[10px]` → `text-xs`

### Điểm sau Phase 9 (ước tính)
- Mobile: 8.5/10 | Tablet: 7.5/10 | Desktop: 7/10

---

## Việc còn lại (backlog)

### Phase 5 UI (chưa làm)
- [ ] Section "Checklist công việc" trong `customers/[id]/page.tsx`
- [ ] Section "Thanh toán 3 đợt" trong `customers/[id]/page.tsx`
- [ ] KPI card + modal "Đặt mục tiêu" trong `staff/page.tsx`

### Phase 7 cleanup (ít ưu tiên)
- [ ] Rewrite `app/api/calendar/route.ts` sang Supabase
- [ ] Rewrite import routes (customers/products) sang Supabase
- [ ] Drop 3 legacy link tables (001/002/003) nếu không còn dùng

### Security (MEDIUM)
- [ ] Thay `select('*')` bằng explicit columns trong payments/tasks routes
- [ ] Fix partner authorization dùng UUID thay vì full_name text match

### UX còn lại
- [ ] Calendar nav buttons `p-2.5` → `p-3`
- [ ] KPI /api/kpi/me: cập nhật `actualContracts` + `actualCustomers` dùng Supabase customers table (Phase 7 đã có bảng)

---

## Quy ước code quan trọng (KHÔNG thay đổi)

| Quy ước | Chi tiết |
|---------|---------|
| URL routes | Giữ `/api/lark/*` dù backend là Supabase |
| record_id | `id.toString()` — Supabase BIGINT → string |
| Dates | DB lưu DATE string; UI nhận/gửi ms timestamp; `new Date(ms).toISOString().split('T')[0]` |
| nguoi_phu_trach | UUID trong DB, trả về `full_name` string cho UI |
| Join syntax | `staff:nguoi_phu_trach(id, full_name)` |
| Auth | `createClient()` cho user queries (RLS); `createServiceClient()` cho admin bypass |
| Error messages | API routes trả `'Lỗi server'` generic (không lộ Supabase schema) |
| Commit style | English imperative, feature/fix/refactor prefix |

---

## Biến môi trường

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only

# LarkBase (legacy sync)
LARK_APP_ID=
LARK_APP_SECRET=
LARK_BASE_APP_TOKEN=

# N8N
N8N_WEBHOOK_URL=
NEXT_PUBLIC_APP_URL=
```
