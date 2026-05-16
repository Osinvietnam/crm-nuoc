-- Migration 068: Đánh giá chất lượng sản phẩm nội bộ (#9)

CREATE TABLE IF NOT EXISTS product_feedback (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_user   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  noi_dung    TEXT,
  nguon       TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'warranty' | 'maintenance'
  ref_id      BIGINT,   -- warranty_ticket.id hoặc maintenance_construction.id
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_feedback_product ON product_feedback(product_id, created_at DESC);
CREATE UNIQUE INDEX idx_product_feedback_user ON product_feedback(product_id, from_user); -- 1 feedback/user/product

ALTER TABLE product_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_select"  ON product_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "feedback_insert"  ON product_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);
CREATE POLICY "feedback_update"  ON product_feedback FOR UPDATE TO authenticated USING (auth.uid() = from_user);
CREATE POLICY "feedback_delete"  ON product_feedback FOR DELETE TO authenticated USING (
  auth.uid() = from_user OR get_my_role() IN ('admin', 'ceo')
);
