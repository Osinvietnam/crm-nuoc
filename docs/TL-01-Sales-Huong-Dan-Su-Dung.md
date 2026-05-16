# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG CRM GWS
## Dành cho: Nhân viên Kinh doanh (Sales)

---

> **CÔNG TY TNHH THƯƠNG MẠI GALAXY WATER SOLUTIONS**
> Hotline hỗ trợ: 1800 9459
> Phiên bản tài liệu: 1.0 — Tháng 5/2026

---

## MỤC LỤC

1. Tổng quan hệ thống
2. Đăng nhập và làm quen giao diện
3. Quản lý Khách hàng
4. Báo giá
5. Hợp đồng
6. Lịch & Công việc hằng ngày
7. Hồ sơ cá nhân
8. Câu hỏi thường gặp (FAQ)
9. Bảng tra cứu nhanh

---

# CHƯƠNG 1 — TỔNG QUAN HỆ THỐNG

## 1.1 Hệ thống CRM GWS là gì?

CRM GWS là phần mềm quản lý quan hệ khách hàng nội bộ của Galaxy Water Solutions. Hệ thống giúp nhân viên kinh doanh theo dõi toàn bộ hành trình khách hàng — từ lúc tiếp nhận lead đến khi bàn giao công trình và bảo hành.

Mọi thông tin được lưu tập trung, cập nhật real-time. Không cần dùng Excel, Zalo hay sổ tay riêng.

## 1.2 Nhân viên Kinh doanh làm được gì trên hệ thống?

| Tính năng | Mô tả |
|-----------|-------|
| Quản lý khách hàng | Thêm, cập nhật, theo dõi tiến trình từng khách |
| Tạo & gửi báo giá | Soạn báo giá, trình CEO duyệt, tải PDF |
| Tạo hợp đồng | Tạo HĐ từ báo giá đã được duyệt, tải PDF |
| Lịch làm việc | Xem lịch hẹn, nhắc nhở công việc |
| Công việc hôm nay | Xem và tick hoàn thành checklist từng bước pipeline |
| Thông báo | Nhận thông báo khi báo giá được duyệt hoặc từ chối |

> ⚠️ **Lưu ý:** Nhân viên kinh doanh chỉ thấy khách hàng được giao cho mình. Khách hàng của đồng nghiệp khác sẽ không hiển thị.

## 1.3 Hành trình khách hàng (Pipeline)

Mỗi khách hàng đi qua các bước sau. Nhân viên kinh doanh phụ trách cập nhật trạng thái theo đúng thực tế:

```
[Lead mới] → [Tiếp cận] → [Tiềm năng] → [Báo giá]
     → [Chờ ký HĐ] → [Đã ký HĐ] → [Giao hàng]
          → [Nghiệm thu] → [Bảo hành] → [Hoàn thành]
```

> 💡 **Mẹo:** Hệ thống sẽ cảnh báo nếu bạn cố chuyển sang bước tiếp theo mà chưa hoàn thành điều kiện (ví dụ: chưa xác nhận thanh toán đợt 1 thì không chuyển sang "Giao hàng" được).

---

# CHƯƠNG 2 — ĐĂNG NHẬP VÀ LÀM QUEN GIAO DIỆN

## 2.1 Đăng nhập lần đầu

**Bước 1:** Mở trình duyệt (Chrome hoặc Safari), truy cập địa chỉ:
```
[ĐỊA CHỈ WEB APP — liên hệ Admin để lấy link]
```

**Bước 2:** Nhập Email và Mật khẩu được Admin cung cấp.

**Bước 3:** Nhấn nút **"Đăng nhập"**.

> `[Ảnh: Màn hình đăng nhập — khoanh đỏ ô Email, ô Mật khẩu, nút Đăng nhập]`

> ⚠️ **Quan trọng:** Sau lần đăng nhập đầu tiên, hãy đổi mật khẩu ngay (xem Chương 7). Mật khẩu tạm thời do Admin cấp không được dùng lâu dài.

## 2.2 Giao diện Dashboard (Trang chính)

Sau khi đăng nhập, bạn thấy trang Dashboard với các thông tin:

> `[Ảnh: Toàn màn hình Dashboard của Sales — chú thích từng khu vực]`

| Khu vực | Chức năng |
|---------|-----------|
| **Thanh menu trái** | Điều hướng đến các trang chính |
| **Thẻ số liệu** | Tổng KH, doanh thu tháng, BG chờ duyệt |
| **Widget "Việc hôm nay"** | Danh sách task cần làm ngay hôm nay |
| **Chuông thông báo** (góc trên phải) | Thông báo mới từ hệ thống |

## 2.3 Các mục trong Menu

| Biểu tượng | Tên mục | Dùng để |
|-----------|---------|---------|
| 🏠 | Dashboard | Xem tổng quan, việc hôm nay |
| 👥 | Khách hàng | Quản lý danh sách KH |
| 📋 | Đơn hàng | Xem báo giá, hợp đồng |
| 📅 | Lịch | Xem lịch hẹn |
| ✅ | Công việc | Danh sách việc cần làm |
| 👤 | Hồ sơ cá nhân | Sửa thông tin, đổi mật khẩu |

---

# CHƯƠNG 3 — QUẢN LÝ KHÁCH HÀNG

## 3.1 Xem danh sách khách hàng

**Bước 1:** Nhấn **"Khách hàng"** trong menu trái.

**Bước 2:** Danh sách khách hàng của bạn hiện ra.

> `[Ảnh: Trang danh sách khách hàng — chú thích thanh tìm kiếm, bộ lọc, danh sách KH]`

**Tìm kiếm khách hàng:**
- Gõ tên hoặc số điện thoại vào ô tìm kiếm phía trên.

**Lọc theo trạng thái pipeline:**
- Nhấn vào các nút lọc (Lead mới / Tiềm năng / Báo giá...) để chỉ hiện KH ở bước đó.

**Xem chi tiết một khách hàng:**
- Nhấn vào tên khách hàng để mở trang chi tiết.

---

## 3.2 Thêm khách hàng mới

**Bước 1:** Trên trang Khách hàng, nhấn nút **"+ Thêm KH"** (góc trên phải).

> `[Ảnh: Nút "+ Thêm KH" được khoanh đỏ]`

**Bước 2:** Điền thông tin vào form:

| Trường | Bắt buộc? | Ghi chú |
|--------|-----------|---------|
| Họ tên KH | ✅ Có | Tên đầy đủ |
| Số điện thoại | ✅ Có | Số di động chính |
| Email | Không | Nếu có |
| Địa chỉ ký HĐ | Không | Địa chỉ trên hợp đồng |
| Địa chỉ công trình | Không | Nơi lắp đặt thực tế |
| Nguồn KH | Không | Giới thiệu / Zalo / Facebook... |
| Mức ưu tiên | Không | Thấp / Trung bình / Cao |
| Nội dung trao đổi | Không | Ghi chú ban đầu |

> `[Ảnh: Form thêm khách hàng — hiển thị đầy đủ các trường]`

**Bước 3:** Nhấn **"Lưu"** để tạo hồ sơ khách hàng.

> 💡 **Mẹo:** Điền càng nhiều thông tin càng tốt ngay từ đầu. Thông tin đầy đủ giúp tạo báo giá và hợp đồng nhanh hơn sau này.

---

## 3.3 Import khách hàng từ file Excel

Dùng khi cần thêm nhiều khách hàng cùng lúc từ danh sách có sẵn.

**Bước 1:** Tải file mẫu Excel về máy.
- Trên trang Khách hàng, nhấn **"Import Excel"** → nhấn **"Tải file mẫu"**.

> `[Ảnh: Nút Import Excel và nút Tải file mẫu]`

**Bước 2:** Mở file mẫu, điền thông tin khách hàng vào từng dòng.

> ⚠️ **Lưu ý khi điền file Excel:**
> - Không xóa hoặc đổi tên các cột tiêu đề
> - Mỗi dòng = 1 khách hàng
> - Cột **Họ tên KH** và **SĐT** là bắt buộc — dòng thiếu 2 trường này sẽ bị bỏ qua

**Bước 3:** Quay lại hệ thống, nhấn **"Import Excel"** → chọn file vừa điền → nhấn **"Tải lên"**.

**Bước 4:** Hệ thống hiện kết quả: bao nhiêu dòng tạo thành công, bao nhiêu dòng bị bỏ qua.

> `[Ảnh: Màn hình kết quả import — hiện số lượng thành công/thất bại]`

---

## 3.4 Cập nhật thông tin khách hàng

**Bước 1:** Nhấn vào tên khách hàng để vào trang chi tiết.

**Bước 2:** Nhấn nút **"Chỉnh sửa"**.

> `[Ảnh: Trang chi tiết KH — khoanh đỏ nút Chỉnh sửa]`

**Bước 3:** Sửa thông tin cần thay đổi.

**Bước 4:** Nhấn **"Lưu"** để cập nhật.

---

## 3.5 Chuyển trạng thái pipeline (Cập nhật bước tiến độ)

Đây là thao tác quan trọng nhất — giúp quản lý và CEO biết KH đang ở đâu trong quá trình bán hàng.

**Bước 1:** Vào trang chi tiết khách hàng.

**Bước 2:** Tìm ô **"Trạng thái pipeline"**, nhấn vào dropdown.

> `[Ảnh: Dropdown pipeline — hiện danh sách các bước]`

**Bước 3:** Chọn trạng thái mới phù hợp.

**Bước 4:** Nhấn **"Lưu"**.

> ⚠️ **Cảnh báo — Hệ thống có thể hiện thông báo:**
>
> | Thông báo | Ý nghĩa | Cần làm gì |
> |-----------|---------|-----------|
> | "Chưa xác nhận thanh toán Đợt 1 (60%)" | Kế toán chưa ghi nhận KH đã cọc | Liên hệ kế toán xác nhận trước |
> | "Còn X việc chưa hoàn thành ở bước hiện tại" | Checklist công việc bước hiện tại chưa tick hết | Hoàn thành các task còn lại trước khi chuyển |
>
> Thông báo này **không chặn** việc chuyển bước — nhưng hãy xử lý trước để đảm bảo quy trình đúng.

---

## 3.6 Xem lịch sử và ghi chú khách hàng

Trên trang chi tiết KH, kéo xuống phần **"Nội dung trao đổi"** để xem và cập nhật ghi chú.

> `[Ảnh: Phần ghi chú / nội dung trao đổi trên trang chi tiết KH]`

---

# CHƯƠNG 4 — BÁO GIÁ

## 4.1 Tổng quan quy trình Báo giá

```
Tạo báo giá (Nháp)
      ↓
Thêm sản phẩm, điều chỉnh chiết khấu
      ↓
  [Chiết khấu trong giới hạn?]
    Có → Chuyển sang "Chờ phản hồi" (gửi thẳng cho KH)
    Không → Tự động "Chờ duyệt" (CEO/Director xem và phê duyệt)
                  ↓ CEO Duyệt
              "Chờ phản hồi"
      ↓
KH phản hồi → "Chấp nhận" hoặc "Từ chối"
```

## 4.2 Tạo báo giá mới

**Bước 1:** Vào trang **Đơn hàng** (menu trái).

**Bước 2:** Nhấn **"+ Tạo báo giá"**.

> `[Ảnh: Trang Đơn hàng — khoanh đỏ nút Tạo báo giá]`

**Bước 3:** Điền thông tin báo giá:

| Trường | Bắt buộc? | Ghi chú |
|--------|-----------|---------|
| Khách hàng | ✅ Có | Chọn từ danh sách KH của bạn |
| Ngày báo giá | ✅ Có | Mặc định = hôm nay |
| Ngày hết hạn | Tự động | Tính theo cấu hình công ty |
| Ghi chú | Không | Ghi chú thêm cho KH |

> `[Ảnh: Form tạo báo giá — điền thông tin cơ bản]`

**Bước 4:** Nhấn **"Tạo"** → báo giá được tạo ở trạng thái **Nháp**.

---

## 4.3 Thêm sản phẩm vào báo giá

**Bước 1:** Sau khi tạo báo giá, vào trang chi tiết báo giá.

**Bước 2:** Tìm phần **"Danh sách sản phẩm"**, nhấn **"+ Thêm sản phẩm"**.

> `[Ảnh: Phần danh sách sản phẩm trong báo giá — khoanh đỏ nút Thêm sản phẩm]`

**Bước 3:** Tìm và chọn sản phẩm:
- Gõ tên hoặc mã sản phẩm vào ô tìm kiếm
- Nhấn chọn sản phẩm từ danh sách

**Bước 4:** Điền số lượng và kiểm tra giá.

**Bước 5:** Nhấn **"Thêm"** — sản phẩm xuất hiện trong bảng báo giá.

**Lặp lại** cho đến khi thêm đủ sản phẩm.

> `[Ảnh: Bảng danh sách sản phẩm trong báo giá — có cột Tên SP, Số lượng, Đơn giá, Thành tiền]`

> 💡 **Mẹo:** Tổng tiền tự động tính khi bạn thêm hoặc thay đổi số lượng sản phẩm.

---

## 4.4 Điều chỉnh chiết khấu

**Bước 1:** Trên trang chi tiết báo giá, tìm ô **"Chiết khấu (%)"**.

**Bước 2:** Nhập % chiết khấu muốn áp dụng.

> ⚠️ **Lưu ý về giới hạn chiết khấu:**
> Công ty quy định mức chiết khấu tối đa nhân viên kinh doanh được phép tự quyết.
> - Nếu chiết khấu **trong giới hạn** → báo giá gửi trực tiếp cho khách, không cần duyệt.
> - Nếu chiết khấu **vượt giới hạn** → hệ thống tự động chuyển sang **"Chờ duyệt"**, CEO/Director sẽ xem xét trước khi gửi KH.

---

## 4.5 Gửi báo giá lên CEO/Director duyệt

Khi báo giá đã hoàn chỉnh và cần trình lên quản lý:

**Bước 1:** Trên trang chi tiết báo giá (đang ở trạng thái Nháp), tìm nút **"Gửi lên duyệt"**.

**Bước 2:** Nhấn **"Gửi lên duyệt"**.

> `[Ảnh: Nút "Gửi lên duyệt" trên trang chi tiết báo giá]`

**Bước 3:** Trạng thái báo giá chuyển sang **"Chờ duyệt"** — CEO/Director nhận thông báo tự động.

**Theo dõi kết quả:**
- Vào trang **Đơn hàng** → Tab **"Báo giá"** để xem trạng thái.
- Bạn cũng nhận thông báo qua chuông 🔔 khi báo giá được Duyệt hoặc Từ chối.

> `[Ảnh: Tab Báo giá — hiện danh sách với cột Trạng thái, badge màu theo trạng thái]`

---

## 4.6 Tải xuống PDF báo giá

**Bước 1:** Vào trang chi tiết báo giá.

**Bước 2:** Nhấn nút **"Tải PDF"** (hoặc **"Xuất PDF"**).

> `[Ảnh: Nút Tải PDF trên trang chi tiết báo giá]`

**Bước 3:** File PDF mở ra trong tab mới của trình duyệt.

**Bước 4:** Nhấn biểu tượng tải xuống (⬇️) hoặc Ctrl+P để lưu / in.

> 💡 **Mẹo:** Báo giá ở trạng thái **Nháp** sẽ có watermark "BẢN NHÁP" trên PDF. Watermark biến mất khi báo giá được duyệt.

---

## 4.7 Nhân bản báo giá (Duplicate)

Dùng khi muốn tạo báo giá mới tương tự báo giá cũ, không cần điền lại từ đầu.

**Bước 1:** Vào trang chi tiết báo giá muốn sao chép.

**Bước 2:** Nhấn nút **"Nhân bản"** (hoặc **"Duplicate"**).

**Bước 3:** Một báo giá mới tự động tạo ra với trạng thái **Nháp** và nội dung giống hệt bản gốc.

**Bước 4:** Chỉnh sửa thông tin cần thay đổi (ví dụ: tên KH, ngày, chiết khấu).

---

## 4.8 Cập nhật trạng thái báo giá sau khi KH phản hồi

Sau khi gửi báo giá cho khách và nhận phản hồi:

**Bước 1:** Vào trang chi tiết báo giá.

**Bước 2:** Nhấn dropdown **"Trạng thái"**, chọn trạng thái phù hợp:

| Trạng thái | Khi nào chọn |
|-----------|-------------|
| Chờ phản hồi | Đã gửi PDF cho KH, đang chờ KH trả lời |
| Chấp nhận | KH đồng ý báo giá → sẵn sàng tạo HĐ |
| Từ chối | KH không đồng ý |
| Hết hạn | Quá ngày hết hạn, KH chưa phản hồi |

---

# CHƯƠNG 5 — HỢP ĐỒNG

## 5.1 Tạo hợp đồng từ báo giá đã được chấp nhận

> ⚠️ **Điều kiện:** Chỉ tạo được hợp đồng khi báo giá đang ở trạng thái **"Chấp nhận"**.

**Bước 1:** Vào trang **Đơn hàng** → Tab **"Báo giá"**.

**Bước 2:** Tìm báo giá đã được KH chấp nhận (badge màu xanh lá "Chấp nhận").

**Bước 3:** Nhấn vào báo giá đó để mở chi tiết.

**Bước 4:** Nhấn nút **"Tạo hợp đồng"**.

> `[Ảnh: Nút "Tạo hợp đồng" trên trang chi tiết báo giá đã chấp nhận]`

**Bước 5:** Form tạo hợp đồng xuất hiện, đã tự động điền sẵn thông tin từ báo giá. Kiểm tra và bổ sung:

| Trường | Ghi chú |
|--------|---------|
| Địa chỉ ký HĐ | Địa chỉ của khách hàng trên hợp đồng |
| Ngày ký HĐ | Ngày 2 bên ký kết |
| Ngày giao hàng dự kiến | Cam kết giao hàng |
| Ghi chú | Điều khoản đặc biệt nếu có |

**Bước 6:** Nhấn **"Tạo hợp đồng"** để lưu.

---

## 5.2 Tải xuống PDF hợp đồng

**Bước 1:** Vào trang **Đơn hàng** → Tab **"Hợp đồng"**.

**Bước 2:** Nhấn vào hợp đồng cần tải.

**Bước 3:** Nhấn nút **"Tải PDF"**.

> `[Ảnh: Nút Tải PDF hợp đồng]`

**Bước 4:** PDF mở trong tab mới. Tải về hoặc in để KH ký.

> 💡 **Lưu ý:** Hợp đồng chưa có chữ ký 2 bên sẽ có watermark "BẢN NHÁP". Sau khi 2 bên đã ký giấy tờ vật lý, Admin/CEO sẽ cập nhật trạng thái hợp đồng trong hệ thống.

---

# CHƯƠNG 6 — LỊCH & CÔNG VIỆC HẰNG NGÀY

## 6.1 Widget "Việc hôm nay" trên Dashboard

Mỗi sáng đăng nhập, hãy xem widget **"Công việc hôm nay"** trên Dashboard — đây là danh sách việc hệ thống nhắc bạn cần làm.

> `[Ảnh: Widget Công việc hôm nay trên Dashboard — hiện danh sách tên KH + việc cần làm]`

Mỗi dòng hiển thị:
- Tên khách hàng
- Công việc cần làm (ví dụ: "Xác nhận lịch lắp đặt", "Gửi báo giá")
- Nhấn vào để đi thẳng đến trang KH đó

---

## 6.2 Trang Công việc (Toàn bộ danh sách)

**Bước 1:** Nhấn **"Công việc"** (biểu tượng ✅) trong menu trái.

**Bước 2:** Danh sách tất cả việc đang chờ bạn xử lý.

> `[Ảnh: Trang Công việc — danh sách task với filter trạng thái]`

**Lọc theo trạng thái:**
- **Chờ làm:** Việc chưa bắt đầu
- **Đang làm:** Việc đang xử lý
- **Hoàn thành:** Việc đã xong

---

## 6.3 Đánh dấu hoàn thành công việc

**Bước 1:** Vào trang chi tiết khách hàng.

**Bước 2:** Kéo xuống phần **"Checklist công việc"**.

> `[Ảnh: Phần Checklist công việc — danh sách task có checkbox]`

**Bước 3:** Nhấn vào checkbox ☐ của việc vừa hoàn thành.

**Bước 4:** Điền ghi chú nếu cần → nhấn **"Xác nhận"**.

> ⚠️ **Lưu ý:** Một số việc yêu cầu upload ảnh hoặc file đính kèm trước khi được tick hoàn thành. Hệ thống sẽ thông báo nếu còn thiếu.

---

## 6.4 Xem Lịch

**Bước 1:** Nhấn **"Lịch"** (biểu tượng 📅) trong menu trái.

**Bước 2:** Lịch hiển thị theo tháng với các sự kiện của bạn.

> `[Ảnh: Trang Lịch — dạng month view, có các event màu khác nhau]`

- Nhấn vào một ngày để xem chi tiết sự kiện trong ngày đó.
- Sự kiện hiện tự động khi có hẹn hoặc deadline từ pipeline KH.

---

# CHƯƠNG 7 — HỒ SƠ CÁ NHÂN

## 7.1 Cập nhật thông tin cá nhân

**Bước 1:** Nhấn vào tên của bạn (góc trên phải) → chọn **"Hồ sơ cá nhân"**.
Hoặc nhấn biểu tượng 👤 trong menu trái.

**Bước 2:** Nhấn **"Chỉnh sửa"**.

**Bước 3:** Cập nhật các trường: Họ tên, Số điện thoại, Khu vực...

**Bước 4:** Nhấn **"Lưu"**.

> `[Ảnh: Trang Hồ sơ cá nhân — form chỉnh sửa]`

---

## 7.2 Đổi mật khẩu

> ⚠️ **Bắt buộc:** Hãy đổi mật khẩu ngay lần đầu đăng nhập!

**Bước 1:** Vào trang **Hồ sơ cá nhân**.

**Bước 2:** Tìm phần **"Đổi mật khẩu"**, nhấn **"Đổi mật khẩu"**.

**Bước 3:** Điền:
- Mật khẩu hiện tại
- Mật khẩu mới (ít nhất 8 ký tự)
- Nhập lại mật khẩu mới

**Bước 4:** Nhấn **"Xác nhận"**.

> 💡 **Mẹo chọn mật khẩu an toàn:** Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt. Ví dụ: `GWS@2026Sales!`

---

# CHƯƠNG 8 — CÂU HỎI THƯỜNG GẶP (FAQ)

---

**❓ Q1: Tôi không thấy khách hàng của mình trên danh sách?**

> **Trả lời:** Danh sách chỉ hiện KH được gán cho bạn. Nếu KH vừa được chuyển giao từ đồng nghiệp, hãy refresh trang (F5). Nếu vẫn không thấy, liên hệ Admin kiểm tra lại phân công.

---

**❓ Q2: Tôi tạo báo giá xong nhưng không thấy nút "Gửi lên duyệt"?**

> **Trả lời:** Nút này chỉ xuất hiện khi báo giá đang ở trạng thái **Nháp** và đã có ít nhất 1 sản phẩm. Hãy kiểm tra: (1) đã thêm sản phẩm chưa? (2) báo giá có đang ở trạng thái Nháp không?

---

**❓ Q3: Hệ thống báo "Chưa xác nhận thanh toán" khi tôi chuyển KH sang "Giao hàng" — tôi phải làm gì?**

> **Trả lời:** Đây là cảnh báo, không phải lỗi. Nghĩa là kế toán chưa ghi nhận KH đã thanh toán đợt 1 (60%). Hãy liên hệ kế toán để xác nhận. Sau đó bạn có thể chuyển pipeline bình thường.

---

**❓ Q4: Tôi có thể sửa báo giá sau khi đã gửi lên duyệt không?**

> **Trả lời:** Báo giá đang ở trạng thái **"Chờ duyệt"** không sửa được trực tiếp. Nếu cần sửa, hãy liên hệ CEO/Director để Từ chối báo giá đó về lại trạng thái Nháp, rồi bạn chỉnh sửa và gửi lại.

---

**❓ Q5: PDF báo giá có chữ "BẢN NHÁP" — có sao không?**

> **Trả lời:** Watermark "BẢN NHÁP" chỉ xuất hiện khi báo giá chưa được duyệt. Sau khi CEO/Director duyệt và trạng thái chuyển sang "Chờ phản hồi" hoặc "Chấp nhận", tải PDF lại sẽ không còn watermark.

---

**❓ Q6: Tôi nhấn "Tạo hợp đồng" nhưng không thấy nút này?**

> **Trả lời:** Nút "Tạo hợp đồng" chỉ xuất hiện khi báo giá đang ở trạng thái **"Chấp nhận"**. Hãy cập nhật trạng thái báo giá thành "Chấp nhận" trước (sau khi KH đồng ý).

---

**❓ Q7: Tôi quên mật khẩu, không đăng nhập được?**

> **Trả lời:** Liên hệ Admin để được đặt lại mật khẩu. Admin sẽ cấp mật khẩu tạm thời, sau đó bạn vào Hồ sơ cá nhân → Đổi mật khẩu ngay.

---

**❓ Q8: Tôi nhận được thông báo "Báo giá bị từ chối" — phải làm gì?**

> **Trả lời:**
> 1. Vào trang Đơn hàng → Tab Báo giá → Tìm báo giá bị từ chối
> 2. Xem lý do từ chối (nếu CEO/Director có để lại ghi chú)
> 3. Nhấn **"Nhân bản"** để tạo bản nháp mới
> 4. Điều chỉnh theo góp ý → Gửi lên duyệt lại

---

# CHƯƠNG 9 — BẢNG TRA CỨU NHANH

| Tôi muốn... | Vào đâu? | Thao tác |
|------------|---------|---------|
| Xem KH của mình | Menu → Khách hàng | Xem danh sách |
| Thêm KH mới | Menu → Khách hàng | Nhấn "+ Thêm KH" |
| Import Excel KH | Menu → Khách hàng | Nhấn "Import Excel" |
| Cập nhật thông tin KH | KH → Nhấn tên KH | Nhấn "Chỉnh sửa" |
| Chuyển bước pipeline | KH → Chi tiết KH | Đổi dropdown Pipeline |
| Tạo báo giá | Menu → Đơn hàng | Nhấn "+ Tạo báo giá" |
| Thêm SP vào BG | Đơn hàng → Chi tiết BG | Nhấn "+ Thêm sản phẩm" |
| Gửi BG lên CEO duyệt | Đơn hàng → Chi tiết BG | Nhấn "Gửi lên duyệt" |
| Tải PDF báo giá | Đơn hàng → Chi tiết BG | Nhấn "Tải PDF" |
| Nhân bản báo giá | Đơn hàng → Chi tiết BG | Nhấn "Nhân bản" |
| Tạo hợp đồng | Đơn hàng → Chi tiết BG (đã Chấp nhận) | Nhấn "Tạo hợp đồng" |
| Tải PDF hợp đồng | Đơn hàng → Tab Hợp đồng → Chi tiết | Nhấn "Tải PDF" |
| Xem việc hôm nay | Dashboard | Xem Widget "Việc hôm nay" |
| Tick hoàn thành task | KH → Chi tiết KH → Checklist | Nhấn checkbox ✅ |
| Xem lịch | Menu → Lịch | Xem month view |
| Đổi mật khẩu | Menu → Hồ sơ → Đổi mật khẩu | Điền 3 ô → Xác nhận |
| Xem thông báo | Chuông 🔔 góc trên phải | Nhấn chuông |

---

## LIÊN HỆ HỖ TRỢ

Nếu gặp vấn đề không xử lý được, hãy liên hệ:

| Vấn đề | Liên hệ |
|--------|---------|
| Không đăng nhập được, quên mật khẩu | Admin hệ thống |
| Không thấy khách hàng, dữ liệu sai | Admin hệ thống |
| Câu hỏi về quy trình nghiệp vụ | Director / CEO |
| Lỗi kỹ thuật (màn hình trắng, báo lỗi đỏ) | Admin hệ thống |

**Hotline GWS:** 1800 9459

---

*Tài liệu này được cập nhật theo phiên bản hệ thống CRM GWS — Tháng 5/2026*
*Mọi thay đổi sẽ được thông báo qua email nội bộ.*

---

> **Ghi chú cho người soạn:**
> Các vị trí có `[Ảnh: ...]` cần chụp màn hình thực tế từ hệ thống và chèn vào đúng vị trí đó.
> Tổng số ảnh cần chụp: **~18 ảnh**
