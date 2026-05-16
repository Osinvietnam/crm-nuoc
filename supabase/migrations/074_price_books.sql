-- Migration 074: Bảng giá động theo nhóm KH (#1)

CREATE TABLE IF NOT EXISTS price_books (
  id              BIGSERIAL PRIMARY KEY,
  ten             TEXT NOT NULL,
  mo_ta           TEXT,
  ap_dung_cho     TEXT[] NOT NULL DEFAULT '{}', -- roles hoặc loai_kh: ['sales','dai_ly',...]
  hieu_luc_tu     DATE,
  hieu_luc_den    DATE,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_book_items (
  id              BIGSERIAL PRIMARY KEY,
  price_book_id   BIGINT NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
  product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  gia_override    BIGINT NOT NULL,
  ghi_chu         TEXT,
  CONSTRAINT price_book_items_unique UNIQUE (price_book_id, product_id)
);

CREATE INDEX idx_price_books_active ON price_books(hieu_luc_tu, hieu_luc_den) WHERE is_default = false;
CREATE INDEX idx_price_book_items_book ON price_book_items(price_book_id);
CREATE INDEX idx_price_book_items_product ON price_book_items(product_id);

ALTER TABLE price_books      ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_book_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_books_select"      ON price_books      FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_books_insert"      ON price_books      FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin','ceo','director'));
CREATE POLICY "price_books_update"      ON price_books      FOR UPDATE TO authenticated USING (get_my_role() IN ('admin','ceo','director'));
CREATE POLICY "price_books_delete"      ON price_books      FOR DELETE TO authenticated USING (get_my_role() IN ('admin','ceo'));
CREATE POLICY "price_book_items_select" ON price_book_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_book_items_write"  ON price_book_items FOR ALL    TO authenticated USING (get_my_role() IN ('admin','ceo','director'));
