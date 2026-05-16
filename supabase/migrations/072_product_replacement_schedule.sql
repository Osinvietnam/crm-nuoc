-- Migration 072: Lịch thay thế định kỳ (#8)

-- Thêm chu kỳ thay thế vào products (đã có loai_sp từ migration 071)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS chu_ky_thay_the INT DEFAULT 0; -- tháng, 0 = không áp dụng

COMMENT ON COLUMN products.chu_ky_thay_the IS 'Chu kỳ thay thế định kỳ (tháng). 0 = không áp dụng. Dùng cho filter/vật tư tiêu hao.';

-- Bảng nhắc nhở thay thế
CREATE TABLE IF NOT EXISTS product_replacement_reminders (
  id              BIGSERIAL PRIMARY KEY,
  order_id        BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id     BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  ngay_lap_dat    DATE,
  ngay_nhac_tiep  DATE NOT NULL,
  is_done         BOOLEAN NOT NULL DEFAULT false,
  assigned_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ghi_chu         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_replacement_reminders_due   ON product_replacement_reminders(ngay_nhac_tiep) WHERE is_done = false;
CREATE INDEX idx_replacement_reminders_order ON product_replacement_reminders(order_id);

ALTER TABLE product_replacement_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_select" ON product_replacement_reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "reminders_insert" ON product_replacement_reminders FOR INSERT TO authenticated WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'director', 'sales', 'tech')
);
CREATE POLICY "reminders_update" ON product_replacement_reminders FOR UPDATE TO authenticated USING (true) WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'director', 'sales')
);
