-- ─── Bảo trì định kỳ ─────────────────────────────────────────────────────────

CREATE TABLE maintenance_periodic (
  id                BIGSERIAL PRIMARY KEY,
  lark_record_id    TEXT UNIQUE,

  customer_id       BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  order_id          BIGINT REFERENCES orders(id)    ON DELETE SET NULL,

  ma_bddk           TEXT,                           -- Mã dịch vụ định kỳ
  san_pham_da_lap   TEXT[],
  dich_vu           TEXT[],                         -- Dịch vụ cần thực hiện
  vat_tu            TEXT[],                         -- Vật tư cần chuẩn bị
  nv_phu_trach      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  khu_vuc           TEXT,

  chu_ky            INT DEFAULT 0,                  -- Chu kỳ (tháng)
  lan_bd_gan_nhat   DATE,
  lan_bd_tiep_theo  DATE,

  trang_thai        TEXT NOT NULL DEFAULT 'Đang hoạt động',
  ghi_chu           TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Lắp đặt công trình ───────────────────────────────────────────────────────

CREATE TABLE maintenance_construction (
  id                BIGSERIAL PRIMARY KEY,
  lark_record_id    TEXT UNIQUE,

  customer_id       BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  order_id          BIGINT REFERENCES orders(id)    ON DELETE SET NULL,

  ma_ct             TEXT,
  san_pham          TEXT,
  ktv_phu_trach     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  khu_vuc           TEXT,

  -- Tiến độ
  ngay_gh_thuc      DATE,                           -- Ngày giao hàng thực
  ngay_nt           DATE,                           -- Ngày nghiệm thu
  trang_thai        TEXT NOT NULL DEFAULT 'Đang thi công',

  -- Computed helpers (lưu để tránh tính lại)
  ngay_can_cs       DATE GENERATED ALWAYS AS (ngay_gh_thuc + INTERVAL '60 days') STORED,
  ngay_het_bh       DATE GENERATED ALWAYS AS (ngay_nt + INTERVAL '24 months') STORED,

  ghi_chu           TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_maint_periodic_customer_id ON maintenance_periodic(customer_id);
CREATE INDEX idx_maint_periodic_nv          ON maintenance_periodic(nv_phu_trach);
CREATE INDEX idx_maint_periodic_tiep_theo   ON maintenance_periodic(lan_bd_tiep_theo);
CREATE INDEX idx_maint_periodic_khu_vuc     ON maintenance_periodic(khu_vuc);
CREATE INDEX idx_maint_periodic_updated_at  ON maintenance_periodic(updated_at);

CREATE INDEX idx_maint_const_customer_id    ON maintenance_construction(customer_id);
CREATE INDEX idx_maint_const_ktv            ON maintenance_construction(ktv_phu_trach);
CREATE INDEX idx_maint_const_trang_thai     ON maintenance_construction(trang_thai);
CREATE INDEX idx_maint_const_khu_vuc        ON maintenance_construction(khu_vuc);
CREATE INDEX idx_maint_const_updated_at     ON maintenance_construction(updated_at);

-- ─── updated_at triggers ─────────────────────────────────────────────────────

CREATE TRIGGER set_maint_periodic_updated_at
  BEFORE UPDATE ON maintenance_periodic
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_maint_const_updated_at
  BEFORE UPDATE ON maintenance_construction
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS: maintenance_periodic ───────────────────────────────────────────────

ALTER TABLE maintenance_periodic ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maint_periodic_select" ON maintenance_periodic FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'accountant', 'tech_lead')
  OR (get_my_role() = 'tech'      AND khu_vuc = get_my_khu_vuc())
  OR (get_my_role() = 'sales'     AND EXISTS (
      SELECT 1 FROM customers c WHERE c.id = customer_id AND c.nguoi_phu_trach = auth.uid()
  ))
  OR (get_my_role() = 'logistics' AND TRUE)
);

CREATE POLICY "maint_periodic_write" ON maintenance_periodic FOR ALL USING (
  get_my_role() IN ('admin', 'ceo', 'tech_lead')
  OR (get_my_role() = 'tech' AND khu_vuc = get_my_khu_vuc())
) WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'tech_lead')
  OR (get_my_role() = 'tech' AND khu_vuc = get_my_khu_vuc())
);

-- ─── RLS: maintenance_construction ───────────────────────────────────────────

ALTER TABLE maintenance_construction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maint_const_select" ON maintenance_construction FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'accountant', 'tech_lead')
  OR (get_my_role() = 'tech'      AND khu_vuc = get_my_khu_vuc())
  OR (get_my_role() = 'sales'     AND EXISTS (
      SELECT 1 FROM customers c WHERE c.id = customer_id AND c.nguoi_phu_trach = auth.uid()
  ))
  OR (get_my_role() = 'logistics' AND TRUE)
);

CREATE POLICY "maint_const_write" ON maintenance_construction FOR ALL USING (
  get_my_role() IN ('admin', 'ceo', 'tech_lead')
  OR (get_my_role() = 'tech' AND khu_vuc = get_my_khu_vuc())
) WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'tech_lead')
  OR (get_my_role() = 'tech' AND khu_vuc = get_my_khu_vuc())
);
