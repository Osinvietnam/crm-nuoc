-- 030: Partner model — loại đối tác + mã + fix RLS dùng UUID

-- ─── 1. profiles: thêm loại & mã đối tác ─────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS loai_doi_tac  TEXT CHECK (loai_doi_tac IN ('Công ty', 'Cá nhân', 'Tổ chức')),
  ADD COLUMN IF NOT EXISTS ma_doi_tac    TEXT UNIQUE;  -- CT-001, CN-001, TC-001...

COMMENT ON COLUMN profiles.loai_doi_tac IS 'Loại đối tác: Công ty | Cá nhân | Tổ chức (chỉ áp dụng khi role=partner)';
COMMENT ON COLUMN profiles.ma_doi_tac   IS 'Mã đối tác tự động: CT-xxx / CN-xxx / TC-xxx';

-- ─── 2. customers: thêm cột doi_tac_id (UUID → profiles) ────────────────────

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS doi_tac_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN customers.doi_tac_id IS 'UUID của profile đối tác giới thiệu (thay thế doi_tac_gt text)';

-- Backfill doi_tac_id từ doi_tac_gt (match theo full_name)
UPDATE customers c
SET doi_tac_id = p.id
FROM profiles p
WHERE p.role = 'partner'
  AND p.full_name = c.doi_tac_gt
  AND c.doi_tac_gt IS NOT NULL
  AND c.doi_tac_id IS NULL;

-- ─── 3. Fix RLS policy customers_select — dùng UUID thay full_name ───────────

DROP POLICY IF EXISTS "customers_select" ON customers;

CREATE POLICY "customers_select" ON customers FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'accountant', 'tech_lead', 'logistics')
  OR (get_my_role() = 'sales'   AND nguoi_phu_trach = auth.uid())
  OR (get_my_role() = 'tech'    AND khu_vuc = get_my_khu_vuc())
  OR (get_my_role() = 'partner' AND doi_tac_id = auth.uid())
);

-- ─── 4. Index hỗ trợ RLS lookup ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_customers_doi_tac_id ON customers(doi_tac_id);
