-- ─── Migration 062: Mở rộng bảng quotes — thêm type + fields per loại ─────────
-- BG-E0: quotes giờ hỗ trợ 3 loại: b2c | commercial | project
-- Tất cả cột mới đều nullable / có default → không ảnh hưởng dữ liệu cũ

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'b2c'
    CHECK (type IN ('b2c', 'commercial', 'project')),

  -- ── Thương mại ──────────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS loai_khach     TEXT,           -- Đại lý / NPP / Siêu thị...
  ADD COLUMN IF NOT EXISTS tinh_thanh     TEXT,           -- dùng cho cả commercial + project
  ADD COLUMN IF NOT EXISTS phuong_thuc_tt TEXT,           -- Phương thức thanh toán

  -- ── Dự án ───────────────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS ten_da         TEXT,           -- Tên dự án
  ADD COLUMN IF NOT EXISTS chu_dau_tu     TEXT,
  ADD COLUMN IF NOT EXISTS loai_da        TEXT,
  ADD COLUMN IF NOT EXISTS quy_mo         TEXT,
  ADD COLUMN IF NOT EXISTS gia_tri_dt     BIGINT DEFAULT 0,   -- Giá trị dự toán ước tính
  ADD COLUMN IF NOT EXISTS ngay_nop_thau  DATE,           -- Ngày nộp thầu / nộp hồ sơ
  ADD COLUMN IF NOT EXISTS doi_tac_da     TEXT;           -- Đối tác tham gia dự án

-- Index để lọc nhanh theo type
CREATE INDEX IF NOT EXISTS idx_quotes_type ON quotes(type);

-- Đảm bảo dữ liệu cũ đều là b2c
UPDATE quotes SET type = 'b2c' WHERE type IS NULL OR type = '';
