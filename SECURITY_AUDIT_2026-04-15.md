# BÁO CÁO AUDIT BẢO MẬT & ĐA THIẾT BỊ
## CRM Mini-ERP Máy Lọc Nước
### Ngày: 2026-04-15

---

## TỔNG QUAN RỦI RO

| Mức độ | Số lượng |
|--------|----------|
| 🔴 Nghiêm trọng (cần fix trước khi go-live) | 3 |
| 🟡 Cảnh báo (cần fix sớm) | 5 |
| 🔵 Cải thiện / Thiếu tính năng | 4 |
| ✅ Đã xử lý tốt | 8 |

---

## CHI TIẾT TỪNG VẤN ĐỀ

---

### 🔴 NGHIÊM TRỌNG

---

**[1] RLS quá rộng — 3 bảng link legacy cho phép MỌI user authenticated CRUD không giới hạn**
- **Vị trí:**
  - `supabase/migrations/001_contract_customer_links.sql` — policy `"authenticated_full_access" FOR ALL USING (true)`
  - `supabase/migrations/002_construction_contract_links.sql` — idem
  - `supabase/migrations/003_quote_customer_links.sql` — idem
- **Mô tả:** Bất kỳ tài khoản nào (kể cả `tech`, `logistics`, `partner`) đều có thể INSERT/UPDATE/DELETE link giữa hợp đồng ↔ khách hàng, giữa công trình ↔ hợp đồng.
- **Rủi ro:** Nhân viên kỹ thuật hoặc đối tác có thể phá vỡ toàn bộ quan hệ dữ liệu, làm N8N sync sai, làm contract detail pages trả về sai KH.
- **Ghi chú:** 3 bảng này là legacy từ giai đoạn LarkBase. Nếu không còn dùng → DROP luôn. Nếu còn dùng → restrict về admin/ceo only.

---

**[2] RLS payment_records — FOR ALL USING (true)**
- **Vị trí:** `supabase/migrations/011_payment_records.sql` — `CREATE POLICY "authenticated users can manage payment records" ON payment_records FOR ALL TO authenticated USING (true) WITH CHECK (true)`
- **Mô tả:** Bất kỳ role nào (kể cả `tech`, `partner`) đều đọc được toàn bộ số tiền thanh toán và có thể đánh dấu `is_paid = true` mà không qua API.
- **Rủi ro:** Lộ dữ liệu tài chính nhạy cảm; nhân viên kỹ thuật có thể tự mark thanh toán, làm sai báo cáo doanh thu; đối tác đọc được số tiền của tất cả khách hàng.
- **Ghi chú:** API layer có kiểm tra role nhưng RLS là lớp bảo vệ cuối cùng — không nên bỏ qua.

---

**[3] RLS company_settings + system_config cho phép MỌI user ghi**
- **Vị trí:**
  - `supabase/migrations/004_company_settings.sql` — policy UPDATE `FOR UPDATE USING (true)`
  - `supabase/migrations/006_system_config.sql` — policy `FOR ALL USING (true) WITH CHECK (true)`
- **Mô tả:** Bất kỳ nhân viên nào cũng có thể sửa tên công ty, MST, URL webhook N8N.
- **Rủi ro nghiêm trọng nhất:** Nếu `N8N_WEBHOOK_URL` trong system_config bị đổi thành server lạ → toàn bộ automation gửi data ra ngoài (data exfiltration). Đây là vector tấn công supply-chain trong nội bộ.
- **Ghi chú:** `system_config` đặc biệt nguy hiểm vì chứa cấu hình vận hành hệ thống.

---

### 🟡 CẢNH BÁO

---

**[4] `signOut()` không truyền `scope: 'global'` — session thiết bị khác không bị kill**
- **Vị trí:**
  - `app/dashboard/layout.tsx` dòng ~38: `await supabase.auth.signOut()`
  - `app/reset-password/page.tsx` dòng ~101: idem
- **Mô tả:** Gọi `signOut()` mặc định chỉ xóa session trên thiết bị hiện tại. Các session đang active trên điện thoại/máy tính khác vẫn còn hiệu lực.
- **Rủi ro:** Nếu nhân viên bị mất điện thoại hoặc nghỉ việc, họ vẫn có thể truy cập từ thiết bị cũ sau khi bị logout ở thiết bị mới.
- **Fix:** `await supabase.auth.signOut({ scope: 'global' })`

---

**[5] quote_items RLS — chỉ check EXISTS, không check role/ownership**
- **Vị trí:** `supabase/migrations/015_quotes.sql` — policy `quote_items_select` dạng `EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id)`
- **Mô tả:** Bất kỳ ai biết `quote_id` đều đọc được line items của báo giá đó. Không kiểm tra người dùng có quyền xem báo giá không.
- **Rủi ro:** `tech`, `logistics` hoặc `partner` có thể enumerate quote_id và đọc được toàn bộ chi tiết báo giá (sản phẩm, đơn giá, chiết khấu).

---

**[6] audit_logs INSERT policy cho phép mọi user authenticated insert**
- **Vị trí:** `supabase/migrations/005_audit_logs.sql` — `CREATE POLICY "authenticated_insert_audit" FOR INSERT WITH CHECK (true)`
- **Mô tả:** Mọi user có thể tự insert bản ghi vào audit_logs với nội dung tuỳ ý.
- **Rủi ro:** Giả mạo lịch sử hành động; đổ lỗi cho user khác; làm nhiễu log để che giấu xâm nhập.
- **Ghi chú:** Theo `WORK_LOG.md` issue C4 đã được fix nhưng migration gốc vẫn có policy này — cần xác nhận migration fix đã được apply trên Supabase Dashboard.

---

**[7] Không có middleware.ts bảo vệ route**
- **Vị trí:** Không tìm thấy file `middleware.ts` ở root project
- **Mô tả:** Không có server-side route guard. Toàn bộ auth check đang ở trong từng page/layout (`useEffect` + redirect). Client-side guard có thể bị bypass nếu JavaScript bị disable hoặc có race condition khi load.
- **Rủi ro:** Trang `/dashboard` render xong rồi mới redirect — brief flash of content có thể lộ thông tin trước khi redirect. Không phải lỗ hổng nghiêm trọng với CRM nội bộ nhưng nên có middleware.

---

**[8] Lark credentials trong .env.local — không có rotation policy**
- **Vị trí:** `.env.local` — `LARK_APP_SECRET`, `LARK_BASE_APP_TOKEN`
- **Mô tả:** Thông tin đăng nhập Lark API được lưu dưới dạng plaintext. Không có bằng chứng về rotation định kỳ.
- **Rủi ro:** Nếu máy developer bị compromise, attacker có thể đọc/sửa toàn bộ dữ liệu LarkBase (TB01–TB13).
- **Ghi chú:** File `.env.local` đúng là được gitignore. Đây là rủi ro từ môi trường dev, không phải từ code.

---

### 🔵 TÍNH NĂNG THIẾU — ĐA THIẾT BỊ

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Danh sách thiết bị đang đăng nhập | ❌ Không có | Không có bảng `user_sessions` |
| Nút "Đăng xuất tất cả thiết bị khác" | ❌ Không có | `signOut()` chỉ local scope |
| Thông báo khi có đăng nhập từ thiết bị mới | ❌ Không có | Không có webhook/email alert |
| Log hoạt động theo thiết bị/IP | ❌ Không có | `audit_logs` ghi action nhưng không ghi IP/user-agent |
| Supabase Realtime sync giữa các tab | ❌ Không có | Không tìm thấy `supabase.channel()` hay `.on("postgres_changes")` |
| Conflict resolution (2 người cùng sửa 1 record) | ❌ Không có | Không có optimistic lock, `updated_at` check, hay Realtime subscription |
| Security headers (HSTS, X-Frame-Options) | ❌ Không có | Không có middleware trả header |

---

## TRẠNG THÁI RLS TỪNG BẢNG

| Bảng | RLS | Policy | Mức độ an toàn |
|------|-----|--------|----------------|
| `profiles` | ✅ | Role-based (self + admin) | 🟢 Tốt |
| `customers` | ✅ | Granular by role (sales/tech/partner filter) | 🟢 Tốt |
| `orders` | ✅ | Role-based (type + nguoi_phu_trach) | 🟢 Tốt |
| `quotes` | ✅ | Role-based (sales ownership) | 🟢 Tốt |
| `quote_items` | ✅ | EXISTS check — thiếu role check | 🟡 Yếu |
| `payment_records` | ✅ | `FOR ALL USING (true)` — quá rộng | 🔴 Rủi ro |
| `maintenance_construction` | ✅ | Role-based (khu_vuc filter) | 🟢 Tốt |
| `maintenance_periodic` | ✅ | Role-based | 🟢 Tốt |
| `kpi_targets` | ✅ | Role-based (self/admin) | 🟢 Tốt |
| `task_completions` | ✅ | `FOR ALL USING (true)` | 🟡 Chấp nhận được |
| `pipeline_history` | ✅ | Immutable (no update/delete) | 🟢 Tốt |
| `company_settings` | ✅ | UPDATE open to all authenticated | 🔴 Rủi ro |
| `system_config` | ✅ | `FOR ALL USING (true)` — quá rộng | 🔴 Rủi ro |
| `audit_logs` | ✅ | INSERT open to all authenticated | 🟡 Yếu |
| `expenses` | ⚠️ Chưa xác nhận | — | ⚠️ Cần kiểm tra |
| `assets` | ⚠️ Chưa xác nhận | — | ⚠️ Cần kiểm tra |
| `contract_customer_links` | ✅ | `FOR ALL USING (true)` — quá rộng | 🔴 Rủi ro |
| `construction_contract_links` | ✅ | `FOR ALL USING (true)` — quá rộng | 🔴 Rủi ro |
| `quote_customer_links` | ✅ | `FOR ALL USING (true)` — quá rộng | 🔴 Rủi ro |

---

### ✅ ĐANG TỐT — GIỮ NGUYÊN

1. **`SUPABASE_SERVICE_ROLE_KEY` server-side only** — không có `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, key chỉ dùng trong API routes, không bao giờ gửi về browser ✅
2. **`getUser()` thay vì `getSession()`** — toàn bộ API routes dùng `supabase.auth.getUser()` (server-validated JWT), không dùng `getSession()` (trust client) ✅
3. **`flowType: 'pkce'`** — `lib/supabase/client.ts` dùng PKCE thay vì implicit flow, chống token interception ✅
4. **Reset password dùng `token_hash` + `code`** — chống email prefetch attack ✅
5. **`createServiceClient()` tách biệt** — không bao giờ expose ra client component ✅
6. **Tất cả API routes check auth trước** — pattern `getUser()` → `if (!user) return 401` nhất quán ✅
7. **Audit logging** — các hành động nhạy cảm (tạo/sửa/offboard nhân viên, set KPI) đều ghi `audit_logs` ✅
8. **Login redirect hardcoded** — `router.push('/dashboard')`, không dùng `router.push(params.redirect)` → không có open redirect ✅

---

## KẾT LUẬN

Hệ thống có **nền tảng auth tốt**: PKCE, server-side validation, service key isolation, audit logging. Tuy nhiên **lớp RLS là điểm yếu nhất**: 6 bảng đang dùng `FOR ALL USING (true)` — bất kỳ tài khoản hợp lệ nào cũng có thể đọc/ghi dữ liệu tài chính, cấu hình hệ thống, và link tables.

**Trước khi đưa khách hàng thật dùng, phải làm 3 việc:**
1. **SQL migration mới** — fix RLS cho `payment_records`, `company_settings`, `system_config`, và 3 link tables (hoặc DROP luôn nếu không còn dùng)
2. **Đổi `signOut()` → `signOut({ scope: 'global' })`** — 2 file, 5 phút
3. **Xác nhận migration fix audit_logs** (C4 trong security audit 2026-04-14) đã thực sự được apply trên Supabase Dashboard

---

## PHỤ LỤC — THỨ TỰ ƯU TIÊN FIX

| # | Việc cần làm | Effort | Impact |
|---|---|---|---|
| 1 | SQL: DROP 3 link tables legacy (nếu không dùng) hoặc restrict admin/ceo only | 10 phút | 🔴 Critical |
| 2 | SQL: fix `payment_records` RLS — restrict by role | 10 phút | 🔴 Critical |
| 3 | SQL: fix `company_settings` + `system_config` — restrict write admin/ceo | 10 phút | 🔴 Critical |
| 4 | Code: `signOut({ scope: 'global' })` — layout.tsx + reset-password/page.tsx | 5 phút | 🟡 Warning |
| 5 | SQL: fix `quote_items` RLS — add role check | 15 phút | 🟡 Warning |
| 6 | SQL: xác nhận audit_logs insert policy đã bị DROP (C4) | 5 phút | 🟡 Warning |
| 7 | Code: thêm `middleware.ts` server-side route guard | 30 phút | 🟡 Warning |
| 8 | Ops: rotate Lark App Secret định kỳ | — | 🟡 Warning |
| 9 | Feature: session management UI (danh sách thiết bị) | 2–3h | 🔵 Cải thiện |
| 10 | Feature: Supabase Realtime conflict resolution | 4–6h | 🔵 Cải thiện |
| 11 | Code: security headers trong middleware | 15 phút | 🔵 Cải thiện |
| 12 | SQL: kiểm tra RLS cho bảng `expenses` + `assets` (Phase 8) | 10 phút | ⚠️ Cần xác nhận |
