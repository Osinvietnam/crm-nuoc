-- ─── Bảng Báo giá + Chi tiết dòng báo giá ───────────────────────────────────

CREATE TABLE quotes (
  id                   BIGSERIAL PRIMARY KEY,
  lark_record_id       TEXT UNIQUE,

  ma_bao_gia           TEXT,
  customer_id          BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  nguoi_phu_trach      UUID REFERENCES profiles(id) ON DELETE SET NULL,

  phien_ban            INT NOT NULL DEFAULT 1,
  trang_thai           TEXT NOT NULL DEFAULT 'Mới tạo',   -- Mới tạo / Đã gửi / Chấp nhận / Từ chối / Hết hạn

  -- Giá trị
  tong_gia_tri         BIGINT DEFAULT 0,
  chiet_khau           INT DEFAULT 0,                     -- %
  gia_tri_sau_ck       BIGINT DEFAULT 0,

  -- Thông tin thêm
  kenh_tiep_nhan       TEXT,
  ghi_chu_ky_thuat     TEXT,
  ghi_chu_thuong_mai   TEXT,
  ly_do_tu_choi        TEXT,
  ma_hd_tham_chieu     TEXT,

  -- Follow-up
  ngay_follow_up       DATE,
  ket_qua_follow_up    TEXT,

  -- Ngày tháng
  ngay_lap             DATE,
  ngay_het_han         DATE,
  ngay_gui_kh          DATE,

  created_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Bảng Chi tiết dòng báo giá ──────────────────────────────────────────────

CREATE TABLE quote_items (
  id          BIGSERIAL PRIMARY KEY,
  quote_id    BIGINT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id  BIGINT REFERENCES products(id) ON DELETE SET NULL,
  ten_sp      TEXT NOT NULL,
  don_gia     BIGINT DEFAULT 0,
  so_luong    INT NOT NULL DEFAULT 1,
  thanh_tien  BIGINT GENERATED ALWAYS AS (don_gia * so_luong) STORED,
  sort_order  INT DEFAULT 0
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_quotes_customer_id       ON quotes(customer_id);
CREATE INDEX idx_quotes_nguoi_phu_trach   ON quotes(nguoi_phu_trach);
CREATE INDEX idx_quotes_trang_thai        ON quotes(trang_thai);
CREATE INDEX idx_quotes_lark_record_id    ON quotes(lark_record_id);
CREATE INDEX idx_quotes_updated_at        ON quotes(updated_at);
CREATE INDEX idx_quote_items_quote_id     ON quote_items(quote_id);

-- ─── updated_at trigger ──────────────────────────────────────────────────────

CREATE TRIGGER set_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS: quotes ─────────────────────────────────────────────────────────────

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select" ON quotes FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'accountant', 'tech_lead', 'logistics')
  OR (get_my_role() = 'sales' AND nguoi_phu_trach = auth.uid())
  OR (get_my_role() = 'tech'  AND EXISTS (
    SELECT 1 FROM customers c WHERE c.id = customer_id AND c.khu_vuc = get_my_khu_vuc()
  ))
);

CREATE POLICY "quotes_insert" ON quotes FOR INSERT WITH CHECK (
  get_my_role() IN ('admin', 'ceo')
  OR (get_my_role() = 'sales' AND nguoi_phu_trach = auth.uid())
);

CREATE POLICY "quotes_update" ON quotes FOR UPDATE USING (
  get_my_role() IN ('admin', 'ceo')
  OR (get_my_role() = 'sales' AND nguoi_phu_trach = auth.uid())
);

CREATE POLICY "quotes_delete" ON quotes FOR DELETE USING (
  get_my_role() IN ('admin', 'ceo')
);

-- ─── RLS: quote_items (kế thừa từ quotes) ────────────────────────────────────

ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_items_select" ON quote_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id)
);

CREATE POLICY "quote_items_insert" ON quote_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id)
);

CREATE POLICY "quote_items_update" ON quote_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id)
);

CREATE POLICY "quote_items_delete" ON quote_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_id)
);
