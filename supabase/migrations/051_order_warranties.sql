-- Migration 051: bảng order_warranties (CJ-12)

CREATE TABLE IF NOT EXISTS order_warranties (
  id          SERIAL PRIMARY KEY,
  order_id    INT  REFERENCES orders(id) ON DELETE CASCADE,
  bat_dau     DATE NOT NULL,
  het_han     DATE NOT NULL,
  loai_bh     TEXT NOT NULL DEFAULT '24 tháng',
  ghi_chu     TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_warranties_order_id ON order_warranties(order_id);

ALTER TABLE order_warranties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warranties_select" ON order_warranties
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "warranties_insert" ON order_warranties
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ceo','director','sales','tech'))
  );

CREATE POLICY "warranties_update" ON order_warranties
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ceo','director'))
  );

CREATE POLICY "warranties_delete" ON order_warranties
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ceo'))
  );
