-- ─── Migration 038: Cập nhật nhân sự chính thức + dọn tài khoản test ──────────
-- Nguồn: nhan-su/nhan-su-gws.docx (10 nhân viên)
-- Chạy trong Supabase SQL Editor

-- ─── BƯỚC 1: Deactivate TẤT CẢ tài khoản KHÔNG nằm trong danh sách chính thức
-- (kể cả test accounts, tài khoản tạo nhầm...)
-- Lưu ý: dùng LOWER() để tránh lỗi case email

UPDATE profiles
SET
  is_active     = false,
  trang_thai_nv = 'Nghỉ việc'
WHERE LOWER(email) NOT IN (
  'ngvuquan01@gmail.com',
  'henrygws@gmail.com',
  'galaxypentair@gmail.com',
  'locnuoc08@gmail.com',
  'ketoanlocnuoc@gmail.com',
  'locnuoc16@gmail.com',
  'lexuanan.gws@gmail.com',
  'trihai.galaxy@gmail.com',
  'huynhthai.gws@gmail.com',
  'dinhhung.galaxygws@gmail.com'
);

-- ─── BƯỚC 2: Đảm bảo 10 nhân viên chính thức đều is_active = true ─────────────

UPDATE profiles SET is_active = true, trang_thai_nv = 'Đang làm'
WHERE LOWER(email) IN (
  'ngvuquan01@gmail.com',
  'henrygws@gmail.com',
  'galaxypentair@gmail.com',
  'locnuoc08@gmail.com',
  'ketoanlocnuoc@gmail.com',
  'locnuoc16@gmail.com',
  'lexuanan.gws@gmail.com',
  'trihai.galaxy@gmail.com',
  'huynhthai.gws@gmail.com',
  'dinhhung.galaxygws@gmail.com'
);

-- ─── BƯỚC 3: Cập nhật từng nhân viên — full_name, role, WBS, chuc_vu ──────────

-- GWS-001 · Vũ Quân · Admin · Cả nước
UPDATE profiles SET
  full_name  = 'Vũ Quân',
  role       = 'admin',
  khu_vuc    = 'CN',
  bo_phan    = 'BLD',
  chuc_danh  = 'BLD-ADM',
  ma_nv      = 'GWS-CN-BLD-001',
  chuc_vu    = 'Quản trị viên hệ thống'
WHERE LOWER(email) = 'ngvuquan01@gmail.com';

-- GWS-002 · Henry · CEO · Cả nước
UPDATE profiles SET
  full_name  = 'Henry',
  role       = 'ceo',
  khu_vuc    = 'CN',
  bo_phan    = 'BLD',
  chuc_danh  = 'BLD-CEO',
  ma_nv      = 'GWS-CN-BLD-002',
  chuc_vu    = 'CEO'
WHERE LOWER(email) = 'henrygws@gmail.com';

-- GWS-003 · Trịnh Kim Ngọc · Giám đốc · Cả nước
UPDATE profiles SET
  full_name  = 'Trịnh Kim Ngọc',
  role       = 'ceo',
  khu_vuc    = 'CN',
  bo_phan    = 'BLD',
  chuc_danh  = 'BLD-GD',
  ma_nv      = 'GWS-CN-BLD-003',
  chuc_vu    = 'Giám đốc'
WHERE LOWER(email) = 'galaxypentair@gmail.com';

-- GWS-004 · Trịnh Kim Nhựt · Phó GĐ kiêm Quản lý KT · Cả nước
UPDATE profiles SET
  full_name  = 'Trịnh Kim Nhựt',
  role       = 'director',
  khu_vuc    = 'CN',
  bo_phan    = 'BLD',
  chuc_danh  = 'BLD-PGD',
  ma_nv      = 'GWS-CN-BLD-004',
  chuc_vu    = 'Phó Giám đốc / Quản lý Kỹ thuật'
WHERE LOWER(email) = 'locnuoc08@gmail.com';

-- GWS-005 · Phạm Thị Liên · Kế toán trưởng · Cả nước
UPDATE profiles SET
  full_name  = 'Phạm Thị Liên',
  role       = 'accountant',
  khu_vuc    = 'CN',
  bo_phan    = 'KTO',
  chuc_danh  = 'KTO-TRG',
  ma_nv      = 'GWS-CN-KTO-001',
  chuc_vu    = 'Kế toán trưởng'
WHERE LOWER(email) = 'ketoanlocnuoc@gmail.com';

-- GWS-006 · Hoàng Thị Minh Chi · Kế toán · Miền Nam
UPDATE profiles SET
  full_name  = 'Hoàng Thị Minh Chi',
  role       = 'accountant',
  khu_vuc    = 'MN',
  bo_phan    = 'KTO',
  chuc_danh  = 'KTO-NV',
  ma_nv      = 'GWS-MN-KTO-001',
  chuc_vu    = 'Kế toán'
WHERE LOWER(email) = 'locnuoc16@gmail.com';

-- GWS-007 · Lê Xuân An · Nhân viên Sale · Miền Nam
UPDATE profiles SET
  full_name  = 'Lê Xuân An',
  role       = 'sales',
  khu_vuc    = 'MN',
  bo_phan    = 'KD',
  chuc_danh  = 'KD-NV',
  ma_nv      = 'GWS-MN-KD-001',
  chuc_vu    = 'Nhân viên Kinh doanh'
WHERE LOWER(email) = 'lexuanan.gws@gmail.com';

-- GWS-008 · Nguyễn Trí Hải · Nhân viên Sale · Miền Nam
UPDATE profiles SET
  full_name  = 'Nguyễn Trí Hải',
  role       = 'sales',
  khu_vuc    = 'MN',
  bo_phan    = 'KD',
  chuc_danh  = 'KD-NV',
  ma_nv      = 'GWS-MN-KD-002',
  chuc_vu    = 'Nhân viên Kinh doanh'
WHERE LOWER(email) = 'trihai.galaxy@gmail.com';

-- GWS-009 · Huỳnh Quốc Thái · Nhân viên Sale · Miền Nam
UPDATE profiles SET
  full_name  = 'Huỳnh Quốc Thái',
  role       = 'sales',
  khu_vuc    = 'MN',
  bo_phan    = 'KD',
  chuc_danh  = 'KD-NV',
  ma_nv      = 'GWS-MN-KD-003',
  chuc_vu    = 'Nhân viên Kinh doanh'
WHERE LOWER(email) = 'huynhthai.gws@gmail.com';

-- GWS-010 · Chu Đình Hưng · Nhân viên Sale · Miền Nam
UPDATE profiles SET
  full_name  = 'Chu Đình Hưng',
  role       = 'sales',
  khu_vuc    = 'MN',
  bo_phan    = 'KD',
  chuc_danh  = 'KD-NV',
  ma_nv      = 'GWS-MN-KD-004',
  chuc_vu    = 'Nhân viên Kinh doanh'
WHERE LOWER(email) = 'dinhhung.galaxygws@gmail.com';

-- ─── BƯỚC 4: Kiểm tra kết quả ─────────────────────────────────────────────────
-- Chạy query này sau để xác nhận:
/*
SELECT
  ma_nv, full_name, email, role, khu_vuc, bo_phan, chuc_vu,
  is_active, trang_thai_nv
FROM profiles
ORDER BY
  CASE is_active WHEN true THEN 0 ELSE 1 END,
  ma_nv NULLS LAST;
*/
