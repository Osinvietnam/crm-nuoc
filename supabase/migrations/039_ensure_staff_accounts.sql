-- ─── Migration 039: Đảm bảo 10 tài khoản tồn tại trong auth.users + profiles ──
-- Chạy trong Supabase SQL Editor (chạy dưới quyền postgres — đủ quyền insert auth.users)
--
-- LOGIC:
--   - Với mỗi trong 10 email: nếu chưa có trong auth.users → tạo mới
--   - Sau đó upsert profile đầy đủ
--   - Mật khẩu tạm: GWS@2026 (các user phải đổi lần đầu đăng nhập)
-- ─────────────────────────────────────────────────────────────────────────────

-- BƯỚC 0: Chạy query kiểm tra trước (uncomment để xem ai đã có, ai chưa có)
/*
SELECT
  p.email,
  p.full_name,
  p.role,
  p.is_active,
  CASE WHEN u.id IS NOT NULL THEN 'Có auth' ELSE 'CHƯA CÓ AUTH' END AS auth_status
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE LOWER(p.email) IN (
  'ngvuquan01@gmail.com','henrygws@gmail.com','galaxypentair@gmail.com',
  'locnuoc08@gmail.com','ketoanlocnuoc@gmail.com','locnuoc16@gmail.com',
  'lexuanan.gws@gmail.com','trihai.galaxy@gmail.com',
  'huynhthai.gws@gmail.com','dinhhung.galaxygws@gmail.com'
)
UNION ALL
SELECT email, '(chưa có profile)' AS full_name, '' AS role, false AS is_active, 'CẦN TẠO' AS auth_status
FROM (VALUES
  ('henrygws@gmail.com'),('galaxypentair@gmail.com'),('locnuoc08@gmail.com'),
  ('ketoanlocnuoc@gmail.com'),('locnuoc16@gmail.com'),('lexuanan.gws@gmail.com'),
  ('trihai.galaxy@gmail.com'),('huynhthai.gws@gmail.com'),('dinhhung.galaxygws@gmail.com')
) AS emails(email)
WHERE email NOT IN (SELECT LOWER(email) FROM profiles)
ORDER BY auth_status, email;
*/

-- ─── BƯỚC 1: Tạo auth.users cho 9 nhân viên (trừ admin đã có) ────────────────
-- Mật khẩu tạm: GWS@2026 — yêu cầu đổi ngay lần đầu

DO $$
DECLARE
  staff RECORD;
  new_id UUID;
BEGIN
  FOR staff IN
    SELECT *
    FROM (VALUES
      ('henrygws@gmail.com',              'Henry'),
      ('galaxypentair@gmail.com',         'Trịnh Kim Ngọc'),
      ('locnuoc08@gmail.com',             'Trịnh Kim Nhựt'),
      ('ketoanlocnuoc@gmail.com',         'Phạm Thị Liên'),
      ('locnuoc16@gmail.com',             'Hoàng Thị Minh Chi'),
      ('lexuanan.gws@gmail.com',          'Lê Xuân An'),
      ('trihai.galaxy@gmail.com',         'Nguyễn Trí Hải'),
      ('huynhthai.gws@gmail.com',         'Huỳnh Quốc Thái'),
      ('dinhhung.galaxygws@gmail.com',    'Chu Đình Hưng')
    ) AS t(email, full_name)
  LOOP
    -- Chỉ tạo nếu chưa tồn tại
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER(staff.email)) THEN
      new_id := gen_random_uuid();

      INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role,
        aud,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
      ) VALUES (
        new_id,
        '00000000-0000-0000-0000-000000000000',
        LOWER(staff.email),
        crypt('GWS@2026', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', staff.full_name),
        false,
        'authenticated',
        'authenticated',
        '', '', '', ''
      );

      RAISE NOTICE 'Đã tạo auth user: % (%)', staff.full_name, staff.email;
    ELSE
      RAISE NOTICE 'Đã tồn tại: %', staff.email;
    END IF;
  END LOOP;
END $$;

-- ─── BƯỚC 2: Upsert profiles cho toàn bộ 10 nhân viên ────────────────────────
-- ON CONFLICT ON id → cập nhật nếu đã có

INSERT INTO profiles (
  id, full_name, email, role, khu_vuc, bo_phan, chuc_danh, ma_nv, chuc_vu,
  trang_thai_nv, is_active
)
SELECT
  u.id,
  s.full_name,
  LOWER(u.email),
  s.role,
  s.khu_vuc,
  s.bo_phan,
  s.chuc_danh,
  s.ma_nv,
  s.chuc_vu,
  'Đang làm',
  true
FROM auth.users u
JOIN (VALUES
  ('ngvuquan01@gmail.com',           'Vũ Quân',             'admin',      'CN', 'BLD', 'BLD-ADM', 'GWS-CN-BLD-001', 'Quản trị viên hệ thống'),
  ('henrygws@gmail.com',             'Henry',               'ceo',        'CN', 'BLD', 'BLD-CEO', 'GWS-CN-BLD-002', 'CEO'),
  ('galaxypentair@gmail.com',        'Trịnh Kim Ngọc',      'ceo',        'CN', 'BLD', 'BLD-GD',  'GWS-CN-BLD-003', 'Giám đốc'),
  ('locnuoc08@gmail.com',            'Trịnh Kim Nhựt',      'director',   'CN', 'BLD', 'BLD-PGD', 'GWS-CN-BLD-004', 'Phó Giám đốc / Quản lý KT'),
  ('ketoanlocnuoc@gmail.com',        'Phạm Thị Liên',       'accountant', 'CN', 'KTO', 'KTO-TRG', 'GWS-CN-KTO-001', 'Kế toán trưởng'),
  ('locnuoc16@gmail.com',            'Hoàng Thị Minh Chi',  'accountant', 'MN', 'KTO', 'KTO-NV',  'GWS-MN-KTO-001', 'Kế toán'),
  ('lexuanan.gws@gmail.com',         'Lê Xuân An',          'sales',      'MN', 'KD',  'KD-NV',   'GWS-MN-KD-001',  'Nhân viên Kinh doanh'),
  ('trihai.galaxy@gmail.com',        'Nguyễn Trí Hải',      'sales',      'MN', 'KD',  'KD-NV',   'GWS-MN-KD-002',  'Nhân viên Kinh doanh'),
  ('huynhthai.gws@gmail.com',        'Huỳnh Quốc Thái',     'sales',      'MN', 'KD',  'KD-NV',   'GWS-MN-KD-003',  'Nhân viên Kinh doanh'),
  ('dinhhung.galaxygws@gmail.com',   'Chu Đình Hưng',       'sales',      'MN', 'KD',  'KD-NV',   'GWS-MN-KD-004',  'Nhân viên Kinh doanh')
) AS s(email, full_name, role, khu_vuc, bo_phan, chuc_danh, ma_nv, chuc_vu)
  ON LOWER(u.email) = LOWER(s.email)
ON CONFLICT (id) DO UPDATE SET
  full_name     = EXCLUDED.full_name,
  role          = EXCLUDED.role,
  khu_vuc       = EXCLUDED.khu_vuc,
  bo_phan       = EXCLUDED.bo_phan,
  chuc_danh     = EXCLUDED.chuc_danh,
  ma_nv         = EXCLUDED.ma_nv,
  chuc_vu       = EXCLUDED.chuc_vu,
  trang_thai_nv = EXCLUDED.trang_thai_nv,
  is_active     = EXCLUDED.is_active;

-- ─── BƯỚC 3: Deactivate tài khoản ngoài danh sách ────────────────────────────

UPDATE profiles
SET is_active = false, trang_thai_nv = 'Nghỉ việc'
WHERE LOWER(email) NOT IN (
  'ngvuquan01@gmail.com', 'henrygws@gmail.com', 'galaxypentair@gmail.com',
  'locnuoc08@gmail.com', 'ketoanlocnuoc@gmail.com', 'locnuoc16@gmail.com',
  'lexuanan.gws@gmail.com', 'trihai.galaxy@gmail.com',
  'huynhthai.gws@gmail.com', 'dinhhung.galaxygws@gmail.com'
);

-- ─── BƯỚC 4: Xác nhận kết quả ────────────────────────────────────────────────

SELECT
  p.ma_nv,
  p.full_name,
  p.email,
  p.role,
  p.khu_vuc,
  p.is_active,
  p.trang_thai_nv
FROM profiles p
WHERE p.is_active = true
ORDER BY p.ma_nv NULLS LAST;
