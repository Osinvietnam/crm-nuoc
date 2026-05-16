-- Migration 071: Quản lý tồn kho thực (#2)

-- Thêm cột tồn kho vào products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS so_luong_ton    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canh_bao_ton_thap INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS loai_sp        TEXT NOT NULL DEFAULT 'chinh'; -- 'chinh' | 'phu_kien' | 'vat_tu'

-- Bảng lịch sử nhập/xuất kho
CREATE TABLE IF NOT EXISTS inventory_logs (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  loai        TEXT NOT NULL DEFAULT 'dieu_chinh', -- 'nhap' | 'xuat' | 'dieu_chinh'
  so_luong    INT NOT NULL,   -- dương = nhập/tăng, âm = xuất/giảm
  ton_sau     INT NOT NULL,   -- tồn kho sau giao dịch
  ghi_chu     TEXT,
  ref_table   TEXT,           -- 'orders' | null
  ref_id      BIGINT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_logs_product ON inventory_logs(product_id, created_at DESC);

ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_logs_select" ON inventory_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_logs_insert" ON inventory_logs FOR INSERT TO authenticated WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'director')
);
