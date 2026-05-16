-- Migration 070: Sản phẩm liên quan / combo (#4)

CREATE TABLE IF NOT EXISTS product_relations (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  loai        TEXT NOT NULL DEFAULT 'accessory', -- 'accessory' | 'combo' | 'replacement'
  ghi_chu     TEXT,
  CONSTRAINT product_relations_unique UNIQUE (product_id, related_id),
  CONSTRAINT no_self_relation CHECK (product_id <> related_id)
);

CREATE INDEX idx_product_relations_main ON product_relations(product_id);
CREATE INDEX idx_product_relations_related ON product_relations(related_id);

ALTER TABLE product_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relations_select" ON product_relations FOR SELECT TO authenticated USING (true);
CREATE POLICY "relations_insert" ON product_relations FOR INSERT TO authenticated WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'director')
);
CREATE POLICY "relations_delete" ON product_relations FOR DELETE TO authenticated USING (
  get_my_role() IN ('admin', 'ceo', 'director')
);
