-- ─── Migration 059: Tạo 16 tài khoản nhân viên còn lại ──────────────────────
-- Chạy trong Supabase SQL Editor (postgres level — bypass auth hooks)
-- Password tạm: GWS@2026 — nhân viên đổi ngay lần đầu đăng nhập
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── BƯỚC 1: Tạo auth.users cho 16 nhân viên chưa có tài khoản ───────────────

DO $$
DECLARE
  staff RECORD;
  new_id UUID;
BEGIN
  FOR staff IN
    SELECT *
    FROM (VALUES
      ('ceogws9@gmail.com',             'Yuan Haifan (Henry)'),
      ('gwshoctai@gmail.com',           'Trịnh Học Tài'),
      ('hoctrieu123@gmail.com',         'Trịnh Học Triệu'),
      ('galaxyxuanloc789@gmail.com',    'Phạm Thị Xuân Lộc'),
      ('locnuocgws18@gmail.com',        'Lê Thị Mỹ Linh'),
      ('ketoangws@gmail.com',           'Nguyễn Thị Thủy'),
      ('daoh21768@gmail.com',           'Đào Mạnh Hà'),
      ('daohuy21978@gmail.com',         'Đào Quốc Huy'),
      ('sayke051@gmail.com',            'Lê Thanh Kỷ'),
      ('hoanglan04111986@gmail.com',    'Lâm Hoàng Lân'),
      ('chithanhdb81@gmail.com',        'Nguyễn Chí Thanh'),
      ('lyphung291193@gmail.com',       'Nguyễn Minh Nhật'),
      ('tranthanhcuongk95@gmail.com',   'Trần Thanh Cường'),
      ('nguyenquangtuan987@gmail.com',  'Nguyễn Quang Tuấn'),
      ('nqdai93@gmail.com',             'Nguyễn Quang Đại'),
      ('vothanhphuc17091996@gmail.com', 'Võ Thanh Phúc')
    ) AS t(email, full_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER(staff.email)) THEN
      new_id := gen_random_uuid();

      INSERT INTO auth.users (
        id, instance_id, email,
        encrypted_password, email_confirmed_at,
        created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, role, aud,
        confirmation_token, recovery_token,
        email_change_token_new, email_change
      ) VALUES (
        new_id,
        '00000000-0000-0000-0000-000000000000',
        LOWER(staff.email),
        crypt('GWS@2026', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', staff.full_name),
        false, 'authenticated', 'authenticated',
        '', '', '', ''
      );

      RAISE NOTICE 'Đã tạo: % (%)', staff.full_name, staff.email;
    ELSE
      RAISE NOTICE 'Đã tồn tại, bỏ qua: %', staff.email;
    END IF;
  END LOOP;
END $$;

-- ─── BƯỚC 2: Upsert profiles cho 16 nhân viên mới ────────────────────────────

INSERT INTO profiles (id, full_name, email, role, khu_vuc, chuc_vu, trang_thai_nv, is_active)
SELECT
  u.id,
  s.full_name,
  LOWER(u.email),
  s.role,
  s.khu_vuc,
  s.chuc_vu,
  'Đang làm',
  true
FROM auth.users u
JOIN (VALUES
  ('ceogws9@gmail.com',             'Yuan Haifan (Henry)',  'ceo',       'Nam/Bắc', 'Giám đốc điều hành'),
  ('gwshoctai@gmail.com',           'Trịnh Học Tài',        'tech',      'Nam/Bắc', 'Trưởng Kỹ thuật'),
  ('hoctrieu123@gmail.com',         'Trịnh Học Triệu',      'tech',      'Nam/Bắc', 'Kỹ thuật'),
  ('galaxyxuanloc789@gmail.com',    'Phạm Thị Xuân Lộc',   'sales',     'Nam',     'Kinh doanh'),
  ('locnuocgws18@gmail.com',        'Lê Thị Mỹ Linh',      'sales',     'Nam',     'Kinh doanh'),
  ('ketoangws@gmail.com',           'Nguyễn Thị Thủy',      'logistics', 'Bắc',     'Hậu cần'),
  ('daoh21768@gmail.com',           'Đào Mạnh Hà',          'tech',      'Bắc',     'Kỹ thuật'),
  ('daohuy21978@gmail.com',         'Đào Quốc Huy',         'tech',      'Bắc',     'Kỹ thuật'),
  ('sayke051@gmail.com',            'Lê Thanh Kỷ',          'tech',      'Bắc',     'Kỹ thuật'),
  ('hoanglan04111986@gmail.com',    'Lâm Hoàng Lân',        'tech',      'Nam',     'Kỹ thuật'),
  ('chithanhdb81@gmail.com',        'Nguyễn Chí Thanh',     'tech',      'Nam',     'Kỹ thuật'),
  ('lyphung291193@gmail.com',       'Nguyễn Minh Nhật',     'tech',      'Nam',     'Kỹ thuật'),
  ('tranthanhcuongk95@gmail.com',   'Trần Thanh Cường',     'tech',      'Nam',     'Kỹ thuật'),
  ('nguyenquangtuan987@gmail.com',  'Nguyễn Quang Tuấn',    'tech',      'Nam',     'Kỹ thuật'),
  ('nqdai93@gmail.com',             'Nguyễn Quang Đại',     'tech',      'Nam',     'Kỹ thuật'),
  ('vothanhphuc17091996@gmail.com', 'Võ Thanh Phúc',        'tech',      'Nam',     'Kỹ thuật')
) AS s(email, full_name, role, khu_vuc, chuc_vu)
  ON LOWER(u.email) = LOWER(s.email)
ON CONFLICT (id) DO UPDATE SET
  full_name     = EXCLUDED.full_name,
  role          = EXCLUDED.role,
  khu_vuc       = EXCLUDED.khu_vuc,
  chuc_vu       = EXCLUDED.chuc_vu,
  trang_thai_nv = EXCLUDED.trang_thai_nv,
  is_active     = EXCLUDED.is_active;

-- ─── BƯỚC 3: Cập nhật lại profile 9 nhân viên đã có (đồng bộ role/chuc_vu) ──

UPDATE profiles SET
  full_name = s.full_name, role = s.role, khu_vuc = s.khu_vuc,
  chuc_vu = s.chuc_vu, is_active = true, trang_thai_nv = 'Đang làm'
FROM (VALUES
  ('ngvuquan01@gmail.com',        'Nguyễn Vũ Quân',      'admin',      null,       'Admin hệ thống'),
  ('galaxypentair@gmail.com',     'Trịnh Kim Ngọc',       'director',   'Nam/Bắc',  'Giám đốc'),
  ('locnuoc08@gmail.com',         'Trịnh Kim Nhựt',       'director',   'Nam/Bắc',  'Quản lý'),
  ('ketoanlocnuoc@gmail.com',     'Phạm Thị Liên',        'accountant', 'Nam/Bắc',  'Kế toán'),
  ('locnuoc16@gmail.com',         'Hoàng Thị Minh Chi',   'accountant', 'Nam/Bắc',  'Kế toán'),
  ('lexuanan.gws@gmail.com',      'Lê Xuân An',           'sales',      'Nam',      'Kinh doanh'),
  ('trihai.galaxy@gmail.com',     'Nguyễn Trí Hải',       'sales',      'Nam',      'Kinh doanh'),
  ('huynhthai.gws@gmail.com',     'Huỳnh Quốc Thái',      'sales',      'Nam',      'Kinh doanh'),
  ('dinhhung.galaxygws@gmail.com','Chu Đình Hưng',         'sales',      'Nam',      'Kinh doanh')
) AS s(email, full_name, role, khu_vuc, chuc_vu)
WHERE LOWER(profiles.email) = LOWER(s.email);

-- ─── BƯỚC 4: Seed user_permissions cho tất cả nhân viên mới ─────────────────

INSERT INTO user_permissions (user_id, permission_key, is_enabled)
SELECT p.id, rp.permission_key, rp.is_enabled
FROM profiles p
JOIN roles r ON r.code = p.role
JOIN role_permissions rp ON rp.role_id = r.id
WHERE p.is_active = TRUE
ON CONFLICT (user_id, permission_key) DO NOTHING;

-- ─── BƯỚC 5: Kiểm tra kết quả ────────────────────────────────────────────────

SELECT
  p.full_name,
  p.email,
  p.role,
  p.khu_vuc,
  p.chuc_vu,
  p.is_active,
  COUNT(up.permission_key) AS so_quyen
FROM profiles p
LEFT JOIN user_permissions up ON up.user_id = p.id AND up.is_enabled = true
WHERE p.is_active = true
GROUP BY p.full_name, p.email, p.role, p.khu_vuc, p.chuc_vu, p.is_active
ORDER BY
  CASE p.role
    WHEN 'admin' THEN 1 WHEN 'ceo' THEN 2 WHEN 'director' THEN 3
    WHEN 'accountant' THEN 4 WHEN 'sales' THEN 5
    WHEN 'tech' THEN 6 WHEN 'logistics' THEN 7
    ELSE 8 END,
  p.full_name;
