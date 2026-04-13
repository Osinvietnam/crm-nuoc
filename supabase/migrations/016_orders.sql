-- ─── Bảng Đơn hàng (gộp B2C + Thương mại + Dự án) ──────────────────────────
-- type = 'b2c' | 'commercial' | 'project'
-- Các field type-specific để NULL nếu không áp dụng

CREATE TABLE orders (
  id                  BIGSERIAL PRIMARY KEY,
  lark_record_id      TEXT UNIQUE,

  -- Phân loại
  type                TEXT NOT NULL CHECK (type IN ('b2c', 'commercial', 'project')),

  -- Liên kết
  customer_id         BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  quote_id            BIGINT REFERENCES quotes(id) ON DELETE SET NULL,
  nguoi_phu_trach     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  khu_vuc             TEXT,

  -- Trạng thái & giá trị chung
  trang_thai          TEXT NOT NULL DEFAULT 'Mới',
  ghi_chu             TEXT,

  -- ── B2C (Hợp đồng cá nhân) ──────────────────────────────────────────────
  ma_hd               TEXT,
  gia_tri_hd          BIGINT DEFAULT 0,
  gia_tri_gws         BIGINT DEFAULT 0,             -- Giá trị GWS
  hh_kinh_doanh       BIGINT DEFAULT 0,             -- Hoa hồng KD (VNĐ)
  san_pham            TEXT[],                        -- Sản phẩm chính (array)
  ngay_ky             DATE,
  ngay_giao_dk        DATE,                         -- Ngày giao hàng dự kiến
  ngay_giao_thuc      DATE,                         -- Ngày giao thực tế
  dia_chi_ct          TEXT,

  -- ── Commercial (Thương mại / Đại lý) ────────────────────────────────────
  ma_don              TEXT,
  ngay_dat            DATE,
  loai_khach          TEXT,                         -- Đại lý / NPP / ...
  ten_kh_tm           TEXT,                         -- Tên KH thương mại (khác customer)
  tinh_thanh          TEXT,
  san_pham_text       TEXT,                         -- Sản phẩm | Vật tư (text)
  ma_sp_text          TEXT,                         -- Mã SP|VT
  so_luong            INT DEFAULT 0,
  don_vi              TEXT,
  don_gia             BIGINT DEFAULT 0,
  tong_tien           BIGINT DEFAULT 0,
  phuong_thuc_tt      TEXT,

  -- ── Project (Dự án) ──────────────────────────────────────────────────────
  ma_da               TEXT,
  ten_da              TEXT,
  chu_dau_tu          TEXT,
  tong_thau           TEXT,                         -- Tổng thầu / Đơn vị mời thầu
  loai_da             TEXT,
  quy_mo              TEXT,
  giai_doan           TEXT,                         -- Giai đoạn dự án
  gia_tri_dt          BIGINT DEFAULT 0,             -- Giá trị DT ước tính
  ngay_bao_gia        DATE,                         -- Ngày nộp thầu / báo giá
  ngay_du_kien_ky     DATE,
  ngay_bt_tc          DATE,                         -- Ngày bắt đầu thi công
  ngay_hoan_thanh     DATE,
  doi_tac_da          TEXT,                         -- Đối tác tham gia
  ty_le_thang         NUMERIC(5,2) DEFAULT 0,       -- % tỷ lệ thắng thầu
  cong_no             BIGINT DEFAULT 0,             -- Công nợ còn lại

  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_orders_customer_id       ON orders(customer_id);
CREATE INDEX idx_orders_type              ON orders(type);
CREATE INDEX idx_orders_nguoi_phu_trach   ON orders(nguoi_phu_trach);
CREATE INDEX idx_orders_khu_vuc           ON orders(khu_vuc);
CREATE INDEX idx_orders_trang_thai        ON orders(trang_thai);
CREATE INDEX idx_orders_lark_record_id    ON orders(lark_record_id);
CREATE INDEX idx_orders_updated_at        ON orders(updated_at);

-- ─── updated_at trigger ──────────────────────────────────────────────────────

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON orders FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'accountant', 'tech_lead', 'logistics')
  OR (get_my_role() = 'sales'  AND nguoi_phu_trach = auth.uid())
  OR (get_my_role() = 'tech'   AND khu_vuc = get_my_khu_vuc())
);

CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (
  get_my_role() IN ('admin', 'ceo')
  OR (get_my_role() = 'sales' AND nguoi_phu_trach = auth.uid())
);

CREATE POLICY "orders_update" ON orders FOR UPDATE USING (
  get_my_role() IN ('admin', 'ceo')
  OR (get_my_role() = 'sales'      AND nguoi_phu_trach = auth.uid())
  OR get_my_role() = 'accountant'
);

CREATE POLICY "orders_delete" ON orders FOR DELETE USING (
  get_my_role() IN ('admin', 'ceo')
);
