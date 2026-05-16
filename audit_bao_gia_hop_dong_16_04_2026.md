# BÁO CÁO RÀ SOÁT LUỒNG BÁO GIÁ + HỢP ĐỒNG

**Ngày:** 2026-04-16
**Phạm vi:** Mẫu xuất, lưu trữ, tạo/sửa/duplicate, chuyển trạng thái, chuyển BG → HĐ
**Kết quả tổng quan:** 20 vấn đề phát hiện (3 Critical, 8 High, 9 Medium)

---

## MỤC LỤC
1. [Hiện trạng 10 khía cạnh](#hiện-trạng)
2. [Danh sách 20 vấn đề (ưu tiên)](#20-vấn-đề)
3. [Đề xuất giải pháp theo 3 đợt](#đề-xuất-giải-pháp)

---

<a id="hiện-trạng"></a>
## 1. HIỆN TRẠNG 10 KHÍA CẠNH

### 1.1 Mẫu báo giá (template xuất) — ✅ CÓ ĐỦ
- **PDF**: `components/QuotePDF.tsx` — dùng `@react-pdf/renderer`, font Roboto từ `/public/fonts/`
- **XLSX**: `components/QuoteXLSX.ts` — dùng `xlsx` (SheetJS), có merge cells + column widths
- **UI**: 2 nút "Xuất PDF báo giá" + "Xuất XLSX" ở `app/dashboard/orders/quote/[id]/page.tsx:674-693`, lazy-import
- **Filename**: `${ma_bao_gia}-v${phien_ban}.pdf`
- **Company info**: fetch từ `/api/admin/settings`
- **KHÔNG lưu file đã xuất vào Storage** — chạy client-side, download thẳng về máy
- **KHÔNG có nút "Gửi KH"** (email/Zalo)

### 1.2 Mẫu hợp đồng (template xuất) — ❌ THIẾU HOÀN TOÀN
- `app/dashboard/orders/contract/[id]/page.tsx` chỉ có status sheet + info rows
- Không có `ContractPDF.tsx`, không có template `.docx` mẫu, không có `lib/contract/…`
- Không có nút In/Xuất PDF/DOCX ở đâu cho HĐ B2C, Thương mại, Dự án
- `package.json` không có `docxtemplater`, `pizzip`, `pdf-lib` cho contract

### 1.3 Lưu trữ báo giá
- **Bảng chính**: `quotes` (migration `015_quotes.sql`) — 1 row = 1 phiên bản BG
  - Chứa: `ma_bao_gia`, `customer_id`, `nguoi_phu_trach`, `phien_ban`, `trang_thai`, `tong_gia_tri`, `chiet_khau`, `gia_tri_sau_ck`, `ngay_lap`, `ngay_het_han`, `ngay_gui_kh`, `ghi_chu_*`, `ly_do_tu_choi`, `ma_hd_tham_chieu`
  - **`san_pham`** (TEXT[]) — code POST có insert nhưng **KHÔNG có trong CREATE TABLE của migration 015** → có thể migration đã sửa ngoài repo
- **Bảng chi tiết**: `quote_items` (`quote_id`, `product_id`, `ten_sp`, `don_gia`, `so_luong`, `thanh_tien` generated) — **DEAD CODE**: POST không insert gì vào đây, duplicate có clone nhưng source rỗng → luôn no-op
- **Storage**: không dùng bucket nào cho quote (chỉ `product-images` cho sản phẩm)

### 1.4 Tạo báo giá
- **2 entry point UI**:
  - `/dashboard/orders` tab "Báo giá" → `AddQuoteForm` ở `page.tsx:785-983`
  - `/dashboard/customers/[id]` → inline form ở `page.tsx:458-600`
- **Chọn SP**: dropdown từ products DB (`ProductPicker`) + cho nhập thủ công
- **Auto-calc**: sum qty × unit price client-side (`useQuoteItems`)
- **Mã BG**: `BG-YYYYMM-XXXX` (4 chữ số cuối timestamp)
- **Phiên bản**: query max `phien_ban` theo `customer_id` + 1
- **Trạng thái khởi tạo**: **`'Nháp'`** (code POST) — khác với DEFAULT `'Mới tạo'` trong migration

### 1.5 Sửa báo giá
- **API**: `app/api/lark/quotes/[id]/route.ts` PATCH
- **Allowed fields**: `trang_thai, ly_do_tu_choi, ma_hd_tham_chieu, tong_gia_tri, chiet_khau, san_pham, ghi_chu_*, kenh_tiep_nhan, ket_qua_follow_up, ngay_gui_kh, ngay_follow_up`
- **KHÔNG sửa được**: `ma_bao_gia, customer_id, nguoi_phu_trach, phien_ban, ngay_lap, ngay_het_han, gia_tri_sau_ck`
- **KHÔNG ghi audit log** (trong khi các admin routes khác có gọi `logAudit`)
- **Overwrite trong cùng phiên bản** — không tạo bản mới khi sửa
- **UI edit**: `EditItemsSheet` trong `quote/[id]/page.tsx` — parse lại text `san_pham`, **MẤT ĐƠN GIÁ** → user phải nhập lại
- **Frontend chặn** khi status `Chấp nhận/Từ chối`; **API không enforce** → curl vẫn sửa được

### 1.6 Duplicate báo giá
- **Endpoint**: `app/api/lark/quotes/duplicate/route.ts`
- **Role**: admin/ceo/sales
- **Logic**: SELECT source + `quote_items` → INSERT mới với mã BG mới, `phien_ban` +1, `trang_thai='Nháp'`, `nguoi_phu_trach = current user`
- **Clone `quote_items`**: có code nhưng source luôn rỗng → hiệu quả = 0
- **INSERT cột không tồn tại**: `khach_hang`, `sdt` không có trong migration 015 → có thể fail silently

### 1.7 Chuyển trạng thái (status transitions)

| Trạng thái | Ai set | Automation |
|------------|--------|-----------|
| `'Nháp'` | Auto khi tạo | — |
| `'Đã gửi'` | Thủ công (StatusSheet) | Không tự set `ngay_gui_kh` |
| `'Đàm phán'` | Thủ công | — |
| `'Chấp nhận'` | Thủ công HOẶC auto khi tạo HĐ từ BG | → KH.pipeline='Chốt HĐ' (guard IN Báo giá/Đàm phán) |
| `'Từ chối'` | Thủ công | → KH.pipeline='Đàm phán' (guard IN Báo giá) |
| `'Hết hạn'` | **Chỉ tính client-side**, không ghi DB | Không có cron |

**Bất đồng bộ 3 nguồn**:
| Nguồn | Danh sách status |
|-------|-----------------|
| Migration 015 comment | Mới tạo / Đã gửi / Chấp nhận / Từ chối / Hết hạn |
| `lib/lark/tables.ts` `QUOTE_STATUSES` | Nháp / Đã gửi / Đàm phán / Chấp nhận / Từ chối / Hết hạn |
| Code POST thực tế set | Nháp |
| DB CHECK constraint | **KHÔNG CÓ** |

→ Thực tế không có record nào `'Mới tạo'`.

### 1.8 Chuyển báo giá → hợp đồng
- **Điều kiện UI**: chỉ hiện nút khi `quote.trang_thai === 'Chấp nhận'`
- **Flow**:
  1. `handleCreateContract` → build URL params (`from_quote, khach_hang, sdt, gia_tri, dia_chi_ct`)
  2. Push `/dashboard/orders?tab=b2c&from_quote=...`
  3. Orders page auto-open form với data prefill
  4. User submit → POST `/api/lark/orders?tab=b2c` với `quote_record_id`
  5. Server insert `orders` (type='b2c', `quote_id = parseInt(quote_record_id)`)
  6. Server auto update `quotes.ma_hd_tham_chieu = data.ma_hd` + `trang_thai='Chấp nhận'` (idempotent guard)
  7. Server update `customers.pipeline = 'Chốt HĐ'`
- **Prefill còn thiếu**: `san_pham` (user phải chọn lại)
- **Unique constraint**: mỗi KH tối đa 1 BG `'Chấp nhận'` (migration 024)
- **Nhưng**: route orders KHÔNG block khi BG đã `'Chấp nhận'` từ trước → có thể tạo HĐ thứ 2 trỏ về cùng BG; back-link idempotent giữ nguyên `ma_hd_tham_chieu` đầu tiên

### 1.9 Truy vấn báo giá
- **GET `/api/lark/quotes`**:
  - Param `customer_record_id` → filter theo KH
  - Sales → filter `nguoi_phu_trach = profile.id`
  - Role khác → lấy all
  - Order by `created_at DESC`
  - **Không pagination** — trả toàn bộ
- **UI filter**: search box CLIENT-SIDE `JSON.stringify(item).toLowerCase().includes(q)` → match mọi field
- **RLS**: `sales` chỉ xem của mình; `tech` theo `khu_vuc` của KH; manager roles full

### 1.10 Dashboard stats
- **`pending_quotes`**: filter `['Nháp', 'Đã gửi']` — **BG quá hạn vẫn `'Đã gửi'` bị đếm nhầm**
- **`quotes_stale`**: BG `'Đã gửi'` không kèm filter ngày — mới gửi 1 ngày cũng tính stale
- **Calendar**: filter `['Đã gửi', 'Đàm phán']`

---

<a id="20-vấn-đề"></a>
## 2. 20 VẤN ĐỀ PHÁT HIỆN (PHÂN LOẠI ƯU TIÊN)

### 🔴 CRITICAL (3)

**C1. Status mismatch 3 nguồn + không có CHECK constraint**
- Migration DEFAULT `'Mới tạo'` ↔ Code POST set `'Nháp'` ↔ `QUOTE_STATUSES` có `'Đàm phán'` nhưng không có `'Mới tạo'`
- DB không validate → rác status có thể chen vào
- Refs: `supabase/migrations/015_quotes.sql:12`, `app/api/lark/quotes/route.ts:110`, `lib/lark/tables.ts:140-147`

**C2. Thiếu hoàn toàn template xuất hợp đồng**
- HĐ B2C/Thương mại/Dự án không có mẫu in, không có PDF/DOCX generator
- Giao dịch pháp lý thực tế phải có HĐ ký tay → flow hiện tại rất hụt

**C3. Quote đã `Chấp nhận`/`Từ chối` vẫn sửa được qua API**
- Frontend ẩn nút (line `page.tsx:537`), nhưng PATCH `/api/lark/quotes/[id]` không check trang_thai
- Hệ quả: vỡ tham chiếu `ma_hd_tham_chieu`, sửa giá BG sau khi đã có HĐ
- Refs: `app/api/lark/quotes/[id]/route.ts:39-79`

### 🟠 HIGH (8)

**H1. `quote_items` là dead code**
- Bảng + RLS + index đủ, POST không bao giờ insert, EditItemsSheet không sync, duplicate clone from rỗng
- Đơn giá từng dòng KHÔNG lưu dưới dạng structured → chỉ lưu text `"Tên SP (2x)"` trong `san_pham` TEXT[]
- Hệ quả: sửa BG mất hết đơn giá, không thể truy vấn revenue theo sản phẩm
- Refs: `015_quotes.sql:42-51`, `app/api/lark/quotes/route.ts:103-122`

**H2. Mất đơn giá khi mở EditItemsSheet**
- Parse text `"Tên SP (2x)"` chỉ rút ra tên + qty; `don_gia: 0` → user phải nhập lại toàn bộ
- Refs: `app/dashboard/orders/quote/[id]/page.tsx:275-289`

**H3. Thiếu audit log cho mọi thao tác quote**
- `lib/audit.ts/logAudit` không được gọi ở POST / PATCH / duplicate
- Không truy vết được: ai chuyển "Chấp nhận", ai thay đổi discount, ai xóa
- Refs: `app/api/lark/quotes/**/route.ts`

**H4. Duplicate route INSERT cột không tồn tại**
- `khach_hang`, `sdt` không có trong migration 015 → Postgres strict sẽ fail
- Refs: `app/api/lark/quotes/duplicate/route.ts:64-65`

**H5. Mapper đọc cột rỗng**
- `_mappers.ts:41` fallback `r.khach_hang ?? r.profiles?.full_name ?? ''` — cột không có → luôn fallback chain → UI có thể render chuỗi rỗng
- Refs: `app/api/lark/quotes/_mappers.ts:41`

**H6. Hết hạn chỉ tính client-side**
- Không có cron/trigger set `trang_thai = 'Hết hạn'` khi qua `ngay_het_han`
- Dashboard stats đếm `pending_quotes` bị sai (BG quá hạn vẫn tính pending)
- Refs: `app/api/dashboard/stats/route.ts:144-145`

**H7. Có thể tạo nhiều HĐ cùng trỏ về 1 BG**
- Route `/api/lark/orders` không block khi BG đã `'Chấp nhận'` trước đó
- Back-link idempotent giữ nguyên HĐ đầu → HĐ thứ 2+ vẫn được tạo nhưng BG không biết
- Business rule thực tế: 1 BG = 1 HĐ
- Refs: `app/api/lark/orders/route.ts:156-167`

**H8. Race condition `phien_ban`**
- Không có UNIQUE `(customer_id, phien_ban)`
- 2 sales tạo BG cho cùng KH đồng thời → trùng version
- Refs: `app/api/lark/quotes/route.ts:81-90`

### 🟡 MEDIUM (9)

**M1. Warning "chưa có BG Chấp nhận" không hiện UI**
- Response `warnings[]` từ POST orders → frontend không đọc → user không thấy cảnh báo

**M2. `gia_tri_sau_ck` không recompute server-side khi PATCH**
- Sửa `chiet_khau` hoặc `tong_gia_tri` → `gia_tri_sau_ck` stale
- Mapper fallback client-side che lỗi này

**M3. `ngay_het_han` hard-code 14 ngày**
- POST + duplicate đều `14 * 86_400_000` ms
- Không configurable qua `company_settings`

**M4. "Đã gửi" không auto-set `ngay_gui_kh`**
- User đổi status → quên cập nhật ngày gửi → follow-up sai

**M5. Không có nút "Gửi KH"**
- Cần thao tác 2 bước thủ công: xuất PDF + đổi status

**M6. Transition không phải state machine**
- Có thể nhảy thẳng `Nháp → Chấp nhận` không qua `Đã gửi`
- Không có validation business flow

**M7. Search không có filter theo status/ngày**
- Chỉ search client-side trên text; không có dropdown filter

**M8. Không có pagination**
- GET `/api/lark/quotes` trả toàn bộ; sẽ chậm khi có 1000+ BG

**M9. `quotes_stale` không có filter thời gian**
- Mới gửi 1 ngày cũng bị tính "stale"

---

<a id="đề-xuất-giải-pháp"></a>
## 3. ĐỀ XUẤT GIẢI PHÁP (3 ĐỢT, NOT YET IMPLEMENTED)

### ĐỢT 1 — DATA INTEGRITY (bắt buộc, làm trước)
**Mục tiêu:** đồng bộ schema, chặn sửa sau accept, audit log.

| # | Giải pháp | Files thay đổi | Migration |
|---|-----------|----------------|-----------|
| C1 | Chuẩn hóa status thành 1 nguồn sự thật: `['Nháp','Đã gửi','Đàm phán','Chấp nhận','Từ chối','Hết hạn']`. Thêm CHECK constraint. Đổi migration DEFAULT từ `'Mới tạo'` → `'Nháp'`. Dọn `'Mới tạo'` khỏi comment và UI. | `lib/lark/tables.ts`, comment migration | `026_quote_status_constraint.sql` |
| C3 | PATCH quote guard: nếu `current.trang_thai IN ('Chấp nhận','Từ chối')` → chỉ cho sửa `ghi_chu_*`, `ly_do_tu_choi`, `ket_qua_follow_up`, `ngay_follow_up` (không cho sửa giá/sản phẩm) | `app/api/lark/quotes/[id]/route.ts` | — |
| H3 | Gọi `logAudit()` ở 3 chỗ: POST tạo, PATCH status change (`Chấp nhận/Từ chối/Hết hạn`), duplicate | `app/api/lark/quotes/route.ts`, `[id]/route.ts`, `duplicate/route.ts` | — |
| H4 | Xóa `khach_hang, sdt` khỏi INSERT của duplicate route; xóa `mo_ta, ghi_chu` khỏi insert `quote_items` (hoặc migration thêm cột nếu thực sự cần) | `app/api/lark/quotes/duplicate/route.ts` | Optional: `027_quote_items_meta.sql` |
| H5 | Mapper chỉ dùng `r.customers?.ho_ten ?? ''` thay vì `r.khach_hang` | `app/api/lark/quotes/_mappers.ts:41` | — |
| H7 | POST orders b2c: nếu `quote_record_id` → check `quote.ma_hd_tham_chieu IS NULL`, nếu đã có mã HĐ khác thì block 409 | `app/api/lark/orders/route.ts` | — |
| H8 | UNIQUE `(customer_id, phien_ban)` cho quotes | — | `028_quote_version_unique.sql` |
| M2 | PATCH quote: nếu sửa `tong_gia_tri` hoặc `chiet_khau` → recompute `gia_tri_sau_ck = round(tong * (1-ck/100))` server-side | `app/api/lark/quotes/[id]/route.ts` | — |

**Ước tính:** ~4 giờ, 3 migrations.

### ĐỢT 2 — TÍNH NĂNG NGHIỆP VỤ (High priority)
**Mục tiêu:** giải quyết dead code `quote_items`, thêm template HĐ, hết hạn tự động.

| # | Giải pháp | Files thay đổi | Migration |
|---|-----------|----------------|-----------|
| H1, H2 | **Chuyển sang dùng `quote_items` structured**: POST quote INSERT items (mỗi dòng: product_id, ten_sp, don_gia, so_luong); PATCH quote → transaction thay thế items; EditItemsSheet load từ `quote_items` (còn giữ đơn giá). `san_pham TEXT[]` giữ làm view summary. | `app/api/lark/quotes/route.ts` POST, `[id]/route.ts` PATCH, `EditItemsSheet`, mapper | — |
| H6 | Cron: scheduled task chạy mỗi 6h → UPDATE `quotes SET trang_thai='Hết hạn' WHERE ngay_het_han < today AND trang_thai IN ('Nháp','Đã gửi','Đàm phán')`. Dùng Vercel Cron hoặc Supabase `pg_cron`. | `app/api/cron/quote-expiry/route.ts` NEW + `vercel.json` | — |
| C2 | **Template HĐ B2C** (ưu tiên): tạo `components/ContractPDF.tsx` tương tự QuotePDF. Dữ liệu từ `orders` + `customers` + load terms/điều khoản từ `company_settings`. Thêm nút "Xuất PDF HĐ" ở `orders/contract/[id]/page.tsx` | `components/ContractPDF.tsx` NEW, `app/dashboard/orders/contract/[id]/page.tsx` | — |
| C2 (phụ) | Template HĐ Thương mại + Dự án (có thể làm sau) | similar | — |
| M1 | Frontend đọc `response.warnings[]` từ POST orders → hiển thị toast màu cam (không block) | `app/dashboard/orders/page.tsx` | — |
| M3 | `ngay_het_han` từ `company_settings.quote_expiry_days` (default 14) | `POST quote`, duplicate | `029_add_quote_expiry_setting.sql` |

**Ước tính:** ~10 giờ (ContractPDF mất nhiều nhất).

### ĐỢT 3 — UX & BÁO CÁO (Medium priority)
**Mục tiêu:** trải nghiệm tốt hơn, số liệu dashboard chính xác.

| # | Giải pháp | Files thay đổi |
|---|-----------|---------------|
| M4 | "Đã gửi" → tự set `ngay_gui_kh = today` nếu chưa có | `[id]/route.ts` PATCH |
| M5 | Nút "Gửi KH" combo: xuất PDF + set status `'Đã gửi'` + ghi `ngay_gui_kh` trong 1 click | `quote/[id]/page.tsx` |
| M6 | State machine: `Nháp → Đã gửi → Đàm phán → Chấp nhận/Từ chối`. Hiển thị lý do bắt buộc khi `'Từ chối'`. Block nhảy ngược (trừ admin) | `[id]/route.ts` PATCH validation |
| M7 | Filter UI: dropdown status + date range ở `orders/page.tsx` tab Báo giá | `orders/page.tsx` |
| M8 | Server-side pagination: `GET /api/lark/quotes?page=1&pageSize=50` | `route.ts` GET + UI |
| M9 | `quotes_stale`: thêm filter `ngay_gui_kh < now - 7 days` | `app/api/dashboard/stats/route.ts` |

**Ước tính:** ~6 giờ.

---

## TỔNG KẾT

| Ưu tiên | Số lượng | Tổng thời gian |
|---------|----------|----------------|
| Critical | 3 | Đợt 1 (~4h) |
| High | 8 | Đợt 1-2 (~10h) |
| Medium | 9 | Đợt 2-3 (~8h) |
| **Tổng** | **20** | **~22 giờ** |

**3 migrations mới**: 026, 027 (optional), 028, 029

**Khuyến nghị thứ tự triển khai:**
1. Đợt 1 — làm trước vì block data integrity
2. Đợt 2.H1/H2 — giải quyết root cause dead code `quote_items`
3. Đợt 2.C2 — template HĐ (quan trọng cho giao dịch thực)
4. Đợt 2.H6 + 3 — cron + UX polish

Chờ lệnh để triển khai từng đợt.
