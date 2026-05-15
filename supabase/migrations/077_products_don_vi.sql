-- Migration 077: Thêm cột đơn vị tính cho sản phẩm
-- Dùng để xác định bước nhập số lượng trong báo giá: integer (cái, chiếc...) vs decimal (m, kg...)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS don_vi TEXT DEFAULT 'cái';

COMMENT ON COLUMN products.don_vi IS
  'Đơn vị tính: cái, chiếc, bộ, cụm, hộp, gói, m, m², m³, kg, lít, cuộn, tấm, thanh, cây...';
