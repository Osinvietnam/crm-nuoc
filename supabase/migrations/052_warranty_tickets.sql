-- Migration 052: bảng warranty_tickets (CJ-13)

CREATE TABLE IF NOT EXISTS warranty_tickets (
  id                SERIAL PRIMARY KEY,
  warranty_id       INT  REFERENCES order_warranties(id) ON DELETE SET NULL,
  order_id          INT  REFERENCES orders(id) ON DELETE CASCADE,
  customer_id       INT  REFERENCES customers(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  mo_ta             TEXT,
  priority          TEXT NOT NULL DEFAULT 'Bình thường',
  trang_thai        TEXT NOT NULL DEFAULT 'Chờ xử lý',
  nguoi_xu_ly       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  nguoi_xu_ly_name  TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_name   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warranty_tickets_order_id  ON warranty_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_warranty_tickets_status    ON warranty_tickets(trang_thai);
CREATE INDEX IF NOT EXISTS idx_warranty_tickets_handler   ON warranty_tickets(nguoi_xu_ly);

ALTER TABLE warranty_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wtickets_select" ON warranty_tickets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "wtickets_insert" ON warranty_tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "wtickets_update" ON warranty_tickets
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "wtickets_delete" ON warranty_tickets
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ceo','director'))
  );
