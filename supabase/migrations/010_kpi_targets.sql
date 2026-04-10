-- 010: KPI targets — mục tiêu tháng cho từng nhân viên (do admin/CEO đặt)

CREATE TABLE kpi_targets (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month            INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             INT NOT NULL CHECK (year >= 2024),
  target_revenue   BIGINT NOT NULL DEFAULT 0,   -- doanh thu mục tiêu (VNĐ)
  target_contracts INT NOT NULL DEFAULT 0,       -- số hợp đồng ký mục tiêu
  target_customers INT NOT NULL DEFAULT 0,       -- số KH mới mục tiêu
  notes            TEXT,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

CREATE INDEX ON kpi_targets(user_id);
CREATE INDEX ON kpi_targets(year, month);

ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage kpi targets"
  ON kpi_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE kpi_targets IS 'KPI mục tiêu tháng per nhân viên — admin/CEO đặt target';
COMMENT ON COLUMN kpi_targets.target_revenue   IS 'Doanh thu mục tiêu tháng (VNĐ)';
COMMENT ON COLUMN kpi_targets.target_contracts IS 'Số hợp đồng ký mục tiêu tháng';
COMMENT ON COLUMN kpi_targets.target_customers IS 'Số khách hàng mới mục tiêu tháng';
