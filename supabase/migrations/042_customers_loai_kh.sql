-- ─── Migration 042: Thêm cột loai_kh vào bảng customers ─────────────────────
-- loai_kh: phân loại khách hàng theo kênh (B2C / Đại lý / Dự án)
-- Nullable — khách hàng cũ không bị ảnh hưởng

ALTER TABLE customers ADD COLUMN IF NOT EXISTS loai_kh TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_loai_kh ON customers(loai_kh);

-- Xác nhận
SELECT loai_kh, COUNT(*) AS so_luong
FROM customers
GROUP BY loai_kh
ORDER BY so_luong DESC;
