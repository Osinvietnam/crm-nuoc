-- 007: Thêm các trường hồ sơ nhân sự vào bảng profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS chuc_vu        TEXT,
  ADD COLUMN IF NOT EXISTS khu_vuc        TEXT,
  ADD COLUMN IF NOT EXISTS target_thang   BIGINT,
  ADD COLUMN IF NOT EXISTS ngay_vao_lam   DATE,
  ADD COLUMN IF NOT EXISTS trang_thai_nv  TEXT DEFAULT 'Đang làm';

-- Đồng bộ trang_thai_nv từ is_active hiện có
UPDATE profiles
  SET trang_thai_nv = CASE
    WHEN is_active = true  THEN 'Đang làm'
    ELSE                        'Nghỉ việc'
  END
  WHERE trang_thai_nv IS NULL;

COMMENT ON COLUMN profiles.chuc_vu       IS 'Chức vụ: Giám đốc, Trưởng phòng, Nhân viên,...';
COMMENT ON COLUMN profiles.khu_vuc       IS 'Khu vực phụ trách: Miền Nam, Miền Bắc, Miền Trung';
COMMENT ON COLUMN profiles.target_thang  IS 'Target doanh số tháng (VNĐ)';
COMMENT ON COLUMN profiles.ngay_vao_lam  IS 'Ngày bắt đầu làm việc';
COMMENT ON COLUMN profiles.trang_thai_nv IS 'Trạng thái: Đang làm | Thử việc | Tạm nghỉ | Nghỉ việc';
