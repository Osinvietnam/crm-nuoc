-- Migration 079: Create assets and expenses tables
-- Created: 2026-05-15

-- ─── TABLE: assets (Tài sản cố định) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assets (
  id                  BIGSERIAL PRIMARY KEY,
  ten_tai_san         TEXT NOT NULL,
  loai_tai_san        TEXT NOT NULL CHECK (loai_tai_san IN ('may_moc', 'xe_cong', 'thiet_bi_van_phong', 'khac')),
  gia_tri_ban_dau     NUMERIC(15,2) NOT NULL DEFAULT 0,
  ngay_mua            DATE,
  thoi_gian_kh_thang  INTEGER NOT NULL DEFAULT 36,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  ghi_chu             TEXT,
  created_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_read" ON assets FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'director', 'accountant')
);

CREATE POLICY "assets_write" ON assets FOR ALL USING (
  get_my_role() IN ('admin', 'ceo', 'director')
) WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'director')
);

-- ─── TABLE: expenses (Chi phí vận hành) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id          BIGSERIAL PRIMARY KEY,
  category    TEXT NOT NULL,
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  thang       INTEGER NOT NULL,
  nam         INTEGER NOT NULL,
  mo_ta       TEXT,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_read" ON expenses FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'director', 'accountant')
);

CREATE POLICY "expenses_write" ON expenses FOR ALL USING (
  get_my_role() IN ('admin', 'ceo', 'director', 'accountant')
) WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'director', 'accountant')
);
