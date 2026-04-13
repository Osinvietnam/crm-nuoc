-- ─── Bảng Khách hàng (nguồn chính, thay thế LarkBase) ───────────────────────

CREATE TABLE customers (
  id                   BIGSERIAL PRIMARY KEY,
  lark_record_id       TEXT UNIQUE,                -- LarkBase record ID, dùng cho N8N sync

  -- Thông tin cơ bản
  ho_ten               TEXT NOT NULL,
  sdt                  TEXT,
  sdt_khac             TEXT,
  email                TEXT,
  ma_kh                TEXT,

  -- Địa chỉ
  dia_chi_hd           TEXT,                       -- Địa chỉ ký hợp đồng
  dia_chi_ct           TEXT,                       -- Địa chỉ công trình

  -- Pipeline
  pipeline             TEXT NOT NULL DEFAULT 'Lead mới',
  muc_uu_tien          TEXT,
  ly_do_tu_choi        TEXT,

  -- Người phụ trách (UUID thay vì text)
  nguoi_phu_trach      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  khu_vuc              TEXT,

  -- Nguồn khách hàng
  nguon_kh             TEXT,
  doi_tac_gt           TEXT,                       -- Tên đối tác giới thiệu

  -- Thông tin kỹ thuật
  loai_hinh_nha        TEXT,
  nguon_nuoc           TEXT,
  san_pham_quan_tam    TEXT[],
  nhom_dv              TEXT,                       -- Nhóm dịch vụ
  tien_do_ct           TEXT,                       -- Tiến độ công trình

  -- Tài chính
  bao_gia              BIGINT DEFAULT 0,

  -- Nội dung trao đổi
  noi_dung             TEXT,

  -- Timestamps
  ngay_lien_he_dau     DATE,
  created_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_customers_nguoi_phu_trach ON customers(nguoi_phu_trach);
CREATE INDEX idx_customers_pipeline        ON customers(pipeline);
CREATE INDEX idx_customers_khu_vuc         ON customers(khu_vuc);
CREATE INDEX idx_customers_lark_record_id  ON customers(lark_record_id);
CREATE INDEX idx_customers_updated_at      ON customers(updated_at);  -- cho N8N delta sync

-- ─── updated_at trigger ──────────────────────────────────────────────────────

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- SELECT: phân quyền theo role
CREATE POLICY "customers_select" ON customers FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'accountant', 'tech_lead', 'logistics')
  OR (get_my_role() = 'sales'   AND nguoi_phu_trach = auth.uid())
  OR (get_my_role() = 'tech'    AND khu_vuc = get_my_khu_vuc())
  OR (get_my_role() = 'partner' AND doi_tac_gt = (SELECT full_name FROM profiles WHERE id = auth.uid()))
);

-- INSERT: admin, ceo, sales (của mình)
CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (
  get_my_role() IN ('admin', 'ceo')
  OR (get_my_role() = 'sales' AND nguoi_phu_trach = auth.uid())
);

-- UPDATE: admin, ceo, sales (của mình), accountant (chỉ field tài chính — kiểm soát ở app)
CREATE POLICY "customers_update" ON customers FOR UPDATE USING (
  get_my_role() IN ('admin', 'ceo')
  OR (get_my_role() = 'sales' AND nguoi_phu_trach = auth.uid())
  OR get_my_role() = 'accountant'
) WITH CHECK (
  get_my_role() IN ('admin', 'ceo')
  OR (get_my_role() = 'sales' AND nguoi_phu_trach = auth.uid())
  OR get_my_role() = 'accountant'
);

-- DELETE: chỉ admin
CREATE POLICY "customers_delete" ON customers FOR DELETE USING (
  get_my_role() = 'admin'
);
