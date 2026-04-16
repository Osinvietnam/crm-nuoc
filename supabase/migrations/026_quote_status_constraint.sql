-- C1: Chuẩn hóa trạng thái báo giá
-- Trước khi chạy: kiểm tra records có trang_thai = 'Mới tạo' (migration default cũ)
-- và update sang 'Nháp' để không bị lỗi constraint.

-- Bước 1: Dọn 'Mới tạo' → 'Nháp' (default cũ trong migration 015)
UPDATE quotes SET trang_thai = 'Nháp' WHERE trang_thai = 'Mới tạo';

-- Bước 2: Sửa migration 015 default (nếu bảng còn DEFAULT 'Mới tạo')
ALTER TABLE quotes ALTER COLUMN trang_thai SET DEFAULT 'Nháp';

-- Bước 3: Thêm CHECK constraint
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS chk_quote_status;
ALTER TABLE quotes ADD CONSTRAINT chk_quote_status
  CHECK (trang_thai IN ('Nháp','Đã gửi','Đàm phán','Chấp nhận','Từ chối','Hết hạn'));
