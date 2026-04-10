-- 008: Mở rộng hồ sơ nhân viên cho module Hành chính nhân sự

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ngay_sinh      DATE,
  ADD COLUMN IF NOT EXISTS dia_chi        TEXT,
  ADD COLUMN IF NOT EXISTS cccd           TEXT,
  ADD COLUMN IF NOT EXISTS so_tk_nh       TEXT,
  ADD COLUMN IF NOT EXISTS ngan_hang      TEXT,
  ADD COLUMN IF NOT EXISTS tinh_trang_hn  TEXT,  -- Độc thân | Đã kết hôn | Ly hôn
  ADD COLUMN IF NOT EXISTS ghi_chu_nb     TEXT;  -- Ghi chú nội bộ — chỉ admin/ceo thấy

COMMENT ON COLUMN profiles.ngay_sinh     IS 'Ngày sinh nhân viên';
COMMENT ON COLUMN profiles.dia_chi       IS 'Địa chỉ thường trú';
COMMENT ON COLUMN profiles.cccd          IS 'Số CMND / CCCD';
COMMENT ON COLUMN profiles.so_tk_nh      IS 'Số tài khoản ngân hàng';
COMMENT ON COLUMN profiles.ngan_hang     IS 'Tên ngân hàng (Vietcombank, MB, ...)';
COMMENT ON COLUMN profiles.tinh_trang_hn IS 'Tình trạng hôn nhân: Độc thân | Đã kết hôn | Ly hôn';
COMMENT ON COLUMN profiles.ghi_chu_nb    IS 'Ghi chú nội bộ — chỉ admin và CEO được xem';
