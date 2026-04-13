-- ─── Bảng Sản phẩm (nguồn chính) ────────────────────────────────────────────

CREATE TABLE products (
  id              BIGSERIAL PRIMARY KEY,
  lark_record_id  TEXT UNIQUE,

  -- Thông tin sản phẩm
  ma_sp           TEXT,
  ten_sp          TEXT NOT NULL,
  phan_loai       TEXT,                        -- Phân loại
  nhom_sp         TEXT,                        -- Nhóm SP

  -- Giá
  gia_niem_yet    BIGINT DEFAULT 0,
  gia_chiet_khau  BIGINT DEFAULT 0,
  gia_dai_ly      BIGINT DEFAULT 0,
  gia_npp         BIGINT DEFAULT 0,            -- Giá nhà phân phối
  hh_kd           NUMERIC(5,2) DEFAULT 0,      -- % Hoa hồng KD

  -- Mô tả & ảnh
  mo_ta           TEXT,
  anh_sp          TEXT,                        -- URL Supabase Storage (product-images bucket)

  -- Trạng thái
  con_hang        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INT DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_products_nhom_sp        ON products(nhom_sp);
CREATE INDEX idx_products_con_hang       ON products(con_hang);
CREATE INDEX idx_products_lark_record_id ON products(lark_record_id);

-- ─── updated_at trigger ──────────────────────────────────────────────────────

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Mọi user đăng nhập đều xem được sản phẩm
CREATE POLICY "products_select" ON products FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- Chỉ admin/ceo thêm sửa xóa sản phẩm
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (
  get_my_role() IN ('admin', 'ceo')
);
CREATE POLICY "products_update" ON products FOR UPDATE USING (
  get_my_role() IN ('admin', 'ceo')
);
CREATE POLICY "products_delete" ON products FOR DELETE USING (
  get_my_role() = 'admin'
);
