-- 036: system_config mở rộng + profiles WBS fields + RLS cập nhật
--      Bổ sung ngưỡng phê duyệt động, migrate khu_vuc sang code ngắn,
--      thêm role 'director', fix RLS tech+CN bypass

-- ─── 1. system_config: thêm business rule keys ───────────────────────────────
-- Bảng system_config đã có từ migration 006 (key TEXT PK, value TEXT)

INSERT INTO system_config (key, value) VALUES
  ('ceo_approval_threshold',  '10000000'),  -- 10 triệu VNĐ
  ('sales_max_discount_pct',  '1'),          -- 1%
  ('default_stage_sla_days',  '3'),          -- 3 ngày mặc định
  ('stage_sla_override',      '{"DN":"14","GH":"14","NT":"3"}')
                                             -- Override: Đàm phán 14ng, GH 14ng, NT 3ng
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE system_config IS 'Cấu hình hệ thống key-value — Admin chỉnh qua /admin/settings';

-- ─── 2. profiles: thêm WBS fields ───────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bo_phan   TEXT,   -- 'BLD','KD','KT','KTO','HC'
  ADD COLUMN IF NOT EXISTS chuc_danh TEXT,   -- 'BLD-CEO','KD-NV','KT-NV'...
  ADD COLUMN IF NOT EXISTS ma_nv     TEXT UNIQUE; -- 'GWS-CN-BLD-001'

COMMENT ON COLUMN profiles.bo_phan   IS 'Bộ phận: BLD|KD|KT|KTO|HC';
COMMENT ON COLUMN profiles.chuc_danh IS 'Mã chức danh WBS: BLD-CEO, KD-NV, KT-NV...';
COMMENT ON COLUMN profiles.ma_nv     IS 'Mã nhân viên WBS: GWS-[KV]-[BP]-[SEQ], e.g. GWS-MN-KD-001';

-- ─── 3. Migrate khu_vuc: text dài → code ngắn ────────────────────────────────

UPDATE profiles SET khu_vuc = 'CN' WHERE khu_vuc = 'Cả nước'  OR khu_vuc = 'ca_nuoc';
UPDATE profiles SET khu_vuc = 'MN' WHERE khu_vuc = 'Miền Nam'  OR khu_vuc = 'mien_nam';
UPDATE profiles SET khu_vuc = 'MB' WHERE khu_vuc = 'Miền Bắc'  OR khu_vuc = 'mien_bac';
UPDATE profiles SET khu_vuc = 'MT' WHERE khu_vuc = 'Miền Trung' OR khu_vuc = 'mien_trung';

-- ─── 4. Cập nhật comment get_my_khu_vuc để reflect code mới ─────────────────

COMMENT ON FUNCTION get_my_khu_vuc() IS
  'Trả về khu_vuc code của user: CN|MN|MB|MT (null nếu chưa set)';

-- ─── 5. RLS customers_select: thêm director + tech CN bypass ─────────────────
-- Drop và recreate (migration 030 đã là phiên bản cuối của policy này)

DROP POLICY IF EXISTS "customers_select" ON customers;

CREATE POLICY "customers_select" ON customers FOR SELECT USING (
  -- Admin / CEO / Kế toán / Logistics thấy tất cả
  get_my_role() IN ('admin','ceo','accountant','logistics')

  -- Director thấy tất cả (khu_vuc CN) hoặc khu vực của mình
  OR get_my_role() = 'director'

  -- Sales thấy KH mình phụ trách
  OR (get_my_role() = 'sales' AND nguoi_phu_trach = auth.uid())

  -- Tech: CN → thấy tất cả; khu vực cụ thể → lọc theo khu_vuc
  OR (get_my_role() = 'tech' AND get_my_khu_vuc() = 'CN')
  OR (get_my_role() = 'tech' AND get_my_khu_vuc() != 'CN'
      AND khu_vuc = get_my_khu_vuc())

  -- Partner thấy KH mình giới thiệu
  OR (get_my_role() = 'partner' AND doi_tac_id = auth.uid())
);

-- ─── 6. RLS orders_select: tương tự customers ────────────────────────────────

DROP POLICY IF EXISTS "orders_select" ON orders;

CREATE POLICY "orders_select" ON orders FOR SELECT USING (
  get_my_role() IN ('admin','ceo','accountant','logistics')
  OR get_my_role() = 'director'
  OR (get_my_role() = 'sales' AND EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = orders.customer_id AND c.nguoi_phu_trach = auth.uid()
  ))
  OR (get_my_role() = 'tech' AND get_my_khu_vuc() = 'CN')
  OR (get_my_role() = 'tech' AND get_my_khu_vuc() != 'CN'
      AND EXISTS (
        SELECT 1 FROM customers c
        WHERE c.id = orders.customer_id AND c.khu_vuc = get_my_khu_vuc()
      ))
);

-- ─── 7. RLS quotes_select: thêm director ─────────────────────────────────────

DROP POLICY IF EXISTS "quotes_select" ON quotes;

CREATE POLICY "quotes_select" ON quotes FOR SELECT USING (
  get_my_role() IN ('admin','ceo','accountant')
  OR get_my_role() = 'director'
  OR (get_my_role() = 'sales' AND EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = quotes.customer_id AND c.nguoi_phu_trach = auth.uid()
  ))
  OR (get_my_role() = 'tech' AND get_my_khu_vuc() = 'CN')
);

-- ─── 8. Seed WBS data cho 10 nhân viên hiện tại ──────────────────────────────
-- Chạy UPDATE theo email để an toàn (không dùng hardcode UUID)

UPDATE profiles SET
  bo_phan   = 'BLD',
  chuc_danh = 'BLD-ADM',
  ma_nv     = 'GWS-CN-BLD-001',
  khu_vuc   = 'CN'
WHERE email = 'ngvuquan01@gmail.com';

UPDATE profiles SET
  bo_phan   = 'BLD',
  chuc_danh = 'BLD-CEO',
  ma_nv     = 'GWS-CN-BLD-002',
  khu_vuc   = 'CN'
WHERE email = 'henrygws@gmail.com';

UPDATE profiles SET
  bo_phan   = 'BLD',
  chuc_danh = 'BLD-CEO',
  ma_nv     = 'GWS-CN-BLD-003',
  khu_vuc   = 'CN',
  role      = 'ceo'
WHERE email = 'galaxypentair@gmail.com';

UPDATE profiles SET
  bo_phan   = 'BLD',
  chuc_danh = 'BLD-PGD',
  ma_nv     = 'GWS-CN-BLD-004',
  khu_vuc   = 'CN',
  role      = 'director'
WHERE email = 'locnuoc08@gmail.com';

UPDATE profiles SET
  bo_phan   = 'KTO',
  chuc_danh = 'KTO-TRG',
  ma_nv     = 'GWS-CN-KTO-001',
  khu_vuc   = 'CN',
  role      = 'accountant'
WHERE email = 'ketoanlocnuoc@gmail.com';

UPDATE profiles SET
  bo_phan   = 'KTO',
  chuc_danh = 'KTO-NV',
  ma_nv     = 'GWS-MN-KTO-001',
  khu_vuc   = 'MN',
  role      = 'accountant'
WHERE email = 'locnuoc16@gmail.com';

UPDATE profiles SET
  bo_phan   = 'KD',
  chuc_danh = 'KD-NV',
  ma_nv     = 'GWS-MN-KD-001',
  khu_vuc   = 'MN',
  role      = 'sales'
WHERE email = 'lexuanan.gws@gmail.com';

UPDATE profiles SET
  bo_phan   = 'KD',
  chuc_danh = 'KD-NV',
  ma_nv     = 'GWS-MN-KD-002',
  khu_vuc   = 'MN',
  role      = 'sales'
WHERE email = 'trihai.galaxy@gmail.com';

UPDATE profiles SET
  bo_phan   = 'KD',
  chuc_danh = 'KD-NV',
  ma_nv     = 'GWS-MN-KD-003',
  khu_vuc   = 'MN',
  role      = 'sales'
WHERE email = 'huynhthai.gws@gmail.com';

UPDATE profiles SET
  bo_phan   = 'KD',
  chuc_danh = 'KD-NV',
  ma_nv     = 'GWS-MN-KD-004',
  khu_vuc   = 'MN',
  role      = 'sales'
WHERE email = 'dinhhung.galaxygws@gmail.com';
