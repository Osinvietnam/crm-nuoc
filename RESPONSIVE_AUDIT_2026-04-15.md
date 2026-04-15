# BÁO CÁO AUDIT RESPONSIVE
## CRM Mini-ERP Máy Lọc Nước
### Ngày: 15/04/2026 | Người đánh giá: Claude Code

---

## TỔNG QUAN

- **Tổng số màn hình đã scan:** 19 (17 dashboard pages + layout + login)
- **Tổng số vấn đề phát hiện:** 38
- **Phân loại:** 🔴 Nghiêm trọng: 4 | 🟡 Cần cải thiện: 22 | 🟢 Tốt: 12

---

## ĐIỂM SỐ THEO THIẾT BỊ

| Thiết bị | Điểm | Nhận xét |
|----------|------|----------|
| 📱 Mobile | 7/10 | App được thiết kế mobile-first, layout tổng thể ổn. Vấn đề chính: touch target một số nút nhỏ, stepper buttons 20px, missing CSS classes trong finance page |
| 📟 Tablet | 5/10 | Không có breakpoint nào được định nghĩa ngoại trừ duy nhất 1 chỗ. 2-column grid cứng trông ổn trên mobile nhưng lãng phí không gian trên tablet 768–1024px |
| 💻 Desktop | 4/10 | Layout full-width trên desktop không có max-width container (ngoại trừ profile + finance). KPI grid 2 cột cứng trên màn 1440px trông rất thưa. Bottom nav fixed ở desktop không phù hợp |

---

## CHI TIẾT TỪNG MÀN HÌNH

### 1. `/dashboard` — Trang Tổng quan

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Tablet/Desktop | `grid grid-cols-2` cho KPI cards — không có `md:grid-cols-3` hay `lg:grid-cols-4` | 🟡 | `app/dashboard/page.tsx` | ~80 |
| Desktop | Không có `max-w-*` container — nội dung kéo giãn toàn màn hình 1440px | 🟡 | `app/dashboard/page.tsx` | ~10 |
| Mobile | `w-12` và `w-16` fixed width cho chart labels — truncate text nếu số lớn | 🟡 | `app/dashboard/page.tsx` | ~200 |
| Mobile | `min-w-[80px]` cho pipeline badge — có thể xung đột layout nhỏ | 🟡 | `app/dashboard/page.tsx` | ~222 |

---

### 2. `/login` — Đăng nhập

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| — | Không có vấn đề. `max-w-sm`, `w-full`, padding responsive, input `py-3` đủ 44px | 🟢 | `app/login/page.tsx` | — |

---

### 3. `/dashboard/customers` — Danh sách Khách hàng

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Mobile | Stepper buttons `w-5 h-5` = 20px — chỉ bằng 45% touch target tiêu chuẩn 44px | 🔴 | `app/dashboard/customers/page.tsx` | ~345–347 |
| Mobile | Search input `py-2.5` ≈ 40px — hơi thấp hơn 44px tiêu chuẩn | 🟡 | `app/dashboard/customers/page.tsx` | ~870 |
| Tablet/Desktop | Không có `max-w-*` container, không có responsive breakpoints | 🟡 | `app/dashboard/customers/page.tsx` | — |
| Mobile | `min-w-[72px]` price display trong quote form — acceptable | 🟢 | `app/dashboard/customers/page.tsx` | ~354 |

---

### 4. `/dashboard/customers/[id]` — Chi tiết Khách hàng

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Mobile | Stepper buttons `w-5 h-5` = 20px trong quote items editor | 🔴 | `app/dashboard/customers/[id]/page.tsx` | ~nhiều chỗ |
| Mobile | Back button `p-2.5` ≈ 40px, hơi thấp | 🟡 | `app/dashboard/customers/[id]/page.tsx` | ~header |
| Desktop | `w-36 flex-shrink-0` cho InfoRow label — cố định 144px, đọc được trên mọi màn | 🟢 | `app/dashboard/customers/[id]/page.tsx` | — |

---

### 5. `/dashboard/orders` — Đơn hàng

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Mobile | Stepper buttons `w-5 h-5` = 20px trong quote item form | 🔴 | `app/dashboard/orders/page.tsx` | ~902, 905 |
| Mobile | `grid grid-cols-2 gap-3` trong AddCommercialForm — 2 cột hẹp trên màn 320px | 🟡 | `app/dashboard/orders/page.tsx` | ~523 |
| Desktop | Notification badge `w-4 h-4 text-[10px]` — px size, không scale | 🟡 | `app/dashboard/orders/page.tsx` | ~tab bar |
| Tablet/Desktop | Tab bar `flex gap-1.5 ... overflow-x-auto` — ổn trên mobile, lãng phí desktop | 🟡 | `app/dashboard/orders/page.tsx` | ~1085 |
| Mobile | `min-w-[72px]` price display — OK | 🟢 | `app/dashboard/orders/page.tsx` | ~912 |

---

### 6. `/dashboard/orders/contract/[id]` — Chi tiết Hợp đồng B2C

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Mobile | Action button `px-3 py-1.5` ≈ 36px — dưới 44px | 🟡 | `app/dashboard/orders/contract/[id]/page.tsx` | ~header actions |
| Desktop | `grid grid-cols-2 gap-2` quick actions — không expand thêm cột trên desktop | 🟡 | `app/dashboard/orders/contract/[id]/page.tsx` | ~quick actions |
| Mobile | Bottom sheet responsive tốt, status picker đúng pattern | 🟢 | `app/dashboard/orders/contract/[id]/page.tsx` | — |

---

### 7. `/dashboard/orders/commercial/[id]` — Chi tiết Đơn Thương mại

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Mobile | Action button `px-3 py-1.5` ≈ 36px — dưới 44px | 🟡 | `app/dashboard/orders/commercial/[id]/page.tsx` | ~header |
| Desktop | Không có max-width, không có responsive prefix | 🟡 | `app/dashboard/orders/commercial/[id]/page.tsx` | — |

---

### 8. `/dashboard/orders/project/[id]` — Chi tiết Dự án

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Mobile | Action button `px-3 py-1.5` ≈ 36px — dưới 44px | 🟡 | `app/dashboard/orders/project/[id]/page.tsx` | ~header |
| Mobile | Win rate progress bar `h-2` — đúng, chỉ display không cần touch | 🟢 | `app/dashboard/orders/project/[id]/page.tsx` | — |

---

### 9. `/dashboard/maintenance` — Bảo trì

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Mobile | Search input `py-2.5` ≈ 40px — hơi thấp | 🟡 | `app/dashboard/maintenance/page.tsx` | ~search |
| All | Layout, tab bar, filter chips, cards đều responsive tốt | 🟢 | `app/dashboard/maintenance/page.tsx` | — |

---

### 10. `/dashboard/maintenance/construction/[id]` — Chi tiết Lắp đặt

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Mobile | Action button `px-3 py-1.5` ≈ 36px | 🟡 | `app/dashboard/maintenance/construction/[id]/page.tsx` | ~header |
| All | Timeline, InfoRow, bottom sheet đều ổn | 🟢 | `app/dashboard/maintenance/construction/[id]/page.tsx` | — |

---

### 11. `/dashboard/maintenance/periodic/[id]` — Chi tiết Định kỳ

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| All | CTA `py-4` = 56px tốt. Confirm grid 2 cột + `py-3` đạt 44px. Không có vấn đề | 🟢 | `app/dashboard/maintenance/periodic/[id]/page.tsx` | — |

---

### 12. `/dashboard/staff` — Nhân viên

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Desktop | KPI modal `sm:items-center` — duy nhất responsive prefix trong toàn codebase, đúng | 🟢 | `app/dashboard/staff/page.tsx` | ~620 |
| Mobile | Filter chips `overflow-x-auto` — tốt | 🟢 | `app/dashboard/staff/page.tsx` | ~339 |
| Desktop | Staff card list full-width, không có grid responsive | 🟡 | `app/dashboard/staff/page.tsx` | — |

---

### 13. `/dashboard/products` — Sản phẩm

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| All | `ProductThumb` dùng `style={{ width: size, height: size }}` inline px — không scale với viewport | 🟡 | `app/dashboard/products/page.tsx` | ~ProductThumb |
| Mobile | Admin action button `px-4 py-2` ≈ 40px — hơi thấp | 🟡 | `app/dashboard/products/page.tsx` | ~header |
| All | Filter chips và layout tổng thể tốt | 🟢 | `app/dashboard/products/page.tsx` | — |

---

### 14. `/dashboard/products/[id]` — Chi tiết Sản phẩm

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| All | `ProductThumb` inline style px cứng | 🟡 | `app/dashboard/products/[id]/page.tsx` | ~ProductThumb |
| Desktop | `grid grid-cols-2 gap-4` price display — 2 cột cứng | 🟡 | `app/dashboard/products/[id]/page.tsx` | ~price section |
| Mobile | `w-full max-h-72` cho product image — responsive width, fixed max-height, acceptable | 🟢 | `app/dashboard/products/[id]/page.tsx` | — |

---

### 15. `/dashboard/finance` — Tài chính ⚠️

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| **ALL** | **`crm-input` không được định nghĩa trong CSS — toàn bộ input form Chi phí & Tài sản không có styling** | 🔴 | `app/dashboard/finance/page.tsx` | 414, 419, 422, 424, 552–568 |
| **ALL** | **`crm-btn-primary` không được định nghĩa — button "Lưu chi phí" và "Thêm tài sản" không có styling** | 🔴 | `app/dashboard/finance/page.tsx` | 424, 568 |
| Mobile | Month nav buttons `w-8 h-8` = 32px — dưới 44px | 🟡 | `app/dashboard/finance/page.tsx` | ~month picker |
| Desktop | `max-w-2xl mx-auto` — tốt, đây là màn hình DUY NHẤT có container centering ngoài profile | 🟢 | `app/dashboard/finance/page.tsx` | ~root div |

---

### 16. `/dashboard/admin` — Quản trị

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Mobile | Candidate buttons `px-3 py-2.5` ≈ 40px — hơi thấp | 🟡 | `app/dashboard/admin/page.tsx` | ~candidate list |
| Mobile | `max-h-52` candidate list = 208px fixed — có thể bị cắt nếu nhiều kết quả | 🟡 | `app/dashboard/admin/page.tsx` | ~list |
| Mobile | Bottom sheet pattern đúng, main action buttons `py-3` đạt 44px | 🟢 | `app/dashboard/admin/page.tsx` | — |

---

### 17. `/dashboard/profile` — Hồ sơ

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Desktop | `max-w-lg mx-auto` — tốt, có container centering | 🟢 | `app/dashboard/profile/page.tsx` | ~content |
| Mobile | Form inputs `py-2.5` ≈ 40px — hơi thấp nhất quán với nhiều screen khác | 🟡 | `app/dashboard/profile/page.tsx` | ~inputs |
| Mobile | Form action buttons `py-2.5` ≈ 40px — hơi thấp | 🟡 | `app/dashboard/profile/page.tsx` | ~buttons |

---

### 18. `/dashboard/calendar` — Lịch

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Mobile | Day number touch area `w-7 h-7` = 28px — nhỏ nhưng acceptable cho calendar grid | 🟡 | `app/dashboard/calendar/page.tsx` | ~day cells |
| All | Nav buttons `p-2.5` ≈ 40px — hơi thấp | 🟡 | `app/dashboard/calendar/page.tsx` | ~month nav |
| All | `grid grid-cols-7` đúng cho calendar, `h-full flex flex-col` đúng | 🟢 | `app/dashboard/calendar/page.tsx` | — |

---

### 19. `layout.tsx` — Dashboard Layout (toàn bộ app)

| Thiết bị | Vấn đề | Mức độ | File | Dòng |
|----------|--------|--------|------|------|
| Desktop | Bottom nav `fixed bottom-0` — không phù hợp cho desktop, nên chuyển sang sidebar hoặc top nav trên `lg:` | 🟡 | `app/dashboard/layout.tsx` | ~155 |
| Mobile | Logout button `px-3 py-1.5` ≈ 36px — dưới 44px | 🟡 | `app/dashboard/layout.tsx` | ~header |
| Mobile | Nav item label `text-[10px]` — pixel font size, rất nhỏ | 🟡 | `app/dashboard/layout.tsx` | ~nav label |
| Mobile | `nav-safe` + `content-safe` được dùng đúng cho iPhone notch | 🟢 | `app/dashboard/layout.tsx` | — |
| Mobile | Bottom nav scroll ngang khi menu dài hơn 5 items | 🟢 | `app/dashboard/layout.tsx` | ~163 |

---

## CÁC VẤN ĐỀ PHỔ BIẾN XUYÊN SUỐT

*(Fix 1 lần — hết nhiều chỗ)*

### 1. Action buttons `py-1.5` (≈36px) — xuất hiện ở 6 màn hình
Các nút "Cập nhật", "Sửa" ở header của các detail pages đều dùng `px-3 py-1.5`.
Tăng lên `py-2` hoặc `py-2.5` là đủ.
> Ảnh hưởng: `contract/[id]`, `commercial/[id]`, `project/[id]`, `construction/[id]`, `layout.tsx` (logout button), `admin/page.tsx`

### 2. Stepper buttons `w-5 h-5` (20px) — xuất hiện ở 3 màn hình
Nút `+`/`-` trong quote item editors. Cần tăng hit area lên `w-8 h-8` (32px), giữ icon nhỏ bên trong.
> Ảnh hưởng: `customers/page.tsx` (~345), `customers/[id]/page.tsx`, `orders/page.tsx` (~902)

### 3. `grid grid-cols-2` không có responsive prefix — xuất hiện ở 8 màn hình
KPI dashboard, quick action grids, form grids — tất cả đều cứng 2 cột.
Trên tablet/desktop nên dùng `md:grid-cols-3` hay `lg:grid-cols-4`.
> Ảnh hưởng: `dashboard/page.tsx`, tất cả detail pages, `products/[id]`

### 4. Không có `max-w-*` container — ảnh hưởng 14/17 pages
Chỉ có `profile/page.tsx` (`max-w-lg`), `finance/page.tsx` (`max-w-2xl`) và `login/page.tsx` (`max-w-sm`) có container width.
Toàn bộ dashboard còn lại kéo full-width trên màn 1440px.

### 5. Search/input `py-2.5` (≈40px) — xuất hiện ở 4 màn hình
`customers`, `maintenance`, `profile`, `admin` đều dùng `py-2.5`.
Nên đồng nhất lên `py-3` (≈46px) cho toàn bộ.

### 6. `crm-btn-primary` và `crm-input` không có trong CSS — 1 màn hình, CRITICAL
`finance/page.tsx` dùng các class chưa được định nghĩa trong `globals.css` hay bất kỳ CSS file nào.

---

## MÀN HÌNH CẦN CHÚ Ý NHẤT

**1. `/dashboard/finance` — CRITICAL**
Toàn bộ form nhập chi phí và form thêm tài sản không có styling vì `crm-input` và `crm-btn-primary`
không tồn tại trong CSS. Người dùng sẽ thấy input không có border, button không có màu nền.

**2. `/dashboard/customers` và `/dashboard/customers/[id]` — Stepper 20px**
Nút `+/-` của quote item editor chỉ 20px — người dùng trên điện thoại (app mobile-first)
sẽ bấm nhầm thường xuyên.

**3. `layout.tsx` — Desktop experience**
Bottom nav `fixed bottom-0` không phù hợp cho desktop. Toàn bộ app không có sidebar hay
top nav responsive cho màn lớn. Đây là vấn đề kiến trúc ảnh hưởng 100% màn hình khi dùng
desktop/tablet landscape.

---

## KHÔNG CÓ VẤN ĐỀ — Giữ nguyên

| Màn hình / Pattern | Lý do |
|---|---|
| `/login` | `max-w-sm`, full responsive, inputs đạt 44px |
| `/dashboard/maintenance/periodic/[id]` | CTA 56px, confirm buttons 44px, layout tốt |
| Bottom sheet pattern (toàn app) | `fixed inset-0 z-50 flex flex-col justify-end + rounded-t-3xl + sheet-safe` — chuẩn PWA iOS |
| Filter chips (`overflow-x-auto scrollbar-none`) | Xuất hiện ở 6+ màn hình, đúng pattern |
| `nav-safe` + `content-safe` | Safe area inset đúng cho iPhone notch |
| `crm-spinner` | Loading state nhất quán |
| `staff/page.tsx` KPI modal | Duy nhất có `sm:items-center` responsive |
| Tất cả form inputs `py-3` | Đạt 44px, nhất quán ở các bottom sheet form |
| Calendar `grid grid-cols-7` | Đúng cho date grid |

---

## KHUYẾN NGHỊ ƯU TIÊN

| # | Fix | Impact | Effort ước tính |
|---|---|---|---|
| 1 | Định nghĩa `crm-input` và `crm-btn-primary` trong `globals.css` | 🔴 finance page broken | 5 phút |
| 2 | Tăng stepper buttons từ `w-5 h-5` → `w-8 h-8` (3 files) | 🔴 UX mobile | 15 phút |
| 3 | Tăng action buttons từ `py-1.5` → `py-2` (6 files) | 🟡 touch target | 10 phút |
| 4 | Thêm `max-w-2xl mx-auto` vào root `<div>` của 14 pages còn lại | 🟡 desktop layout | 20 phút |
| 5 | Đồng nhất search inputs từ `py-2.5` → `py-3` (4 files) | 🟡 consistency | 10 phút |
| 6 | Thêm `md:grid-cols-3 lg:grid-cols-4` cho KPI/action grids | 🟡 tablet/desktop | 30 phút |
| 7 | `layout.tsx`: thêm `lg:hidden` cho bottom nav + `hidden lg:flex` sidebar | 🟡 desktop nav | 60 phút |

---

## GHI CHÚ KỸ THUẬT

- **Tailwind version**: v4 (cú pháp `@import "tailwindcss"`, không có `tailwind.config.js`)
- **Breakpoints mặc định Tailwind v4**: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`
- **Responsive prefix được dùng trong codebase**: CHỈ 1 chỗ duy nhất — `sm:items-center` tại `staff/page.tsx:620`
- **UI Library**: Không dùng shadcn, antd, MUI — toàn bộ là Tailwind utility classes
- **Custom CSS classes** (định nghĩa trong `globals.css`): `nav-safe`, `content-safe`, `sheet-safe`, `crm-spinner`, `scrollbar-none`, `ptr-wrapper`
- **Custom CSS classes bị thiếu** (dùng nhưng chưa định nghĩa): `crm-input`, `crm-btn-primary`
