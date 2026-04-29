-- migration 046: thêm trạng thái 'Chờ duyệt' vào quotes
-- CEO-03: approval workflow — sales gửi duyệt, manager approve/reject

-- Bước 1: Drop constraint cũ
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS chk_trang_thai_valid;

-- Bước 2: Thêm constraint mới với 'Chờ duyệt'
ALTER TABLE quotes ADD CONSTRAINT chk_trang_thai_valid
  CHECK (trang_thai IN ('Nháp','Đã gửi','Đàm phán','Chờ duyệt','Chấp nhận','Từ chối','Hết hạn'));

-- Bước 3: Index để query pending approvals nhanh
CREATE INDEX IF NOT EXISTS idx_quotes_cho_duyet ON quotes(trang_thai) WHERE trang_thai = 'Chờ duyệt';
