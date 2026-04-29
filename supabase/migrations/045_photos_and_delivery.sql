-- migration 045: ảnh nghiệm thu bảo trì + xác nhận giao hàng
-- TECH-01: maintenance_construction.hinh_anh TEXT[]
-- LOG-04: orders.delivery_confirmed_at, delivery_notes, delivery_photos TEXT[]

ALTER TABLE maintenance_construction
  ADD COLUMN IF NOT EXISTS hinh_anh TEXT[] DEFAULT '{}';

COMMENT ON COLUMN maintenance_construction.hinh_anh IS 'Danh sách URL ảnh nghiệm thu — lưu Supabase Storage bucket task-attachments';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_notes        TEXT,
  ADD COLUMN IF NOT EXISTS delivery_photos       TEXT[] DEFAULT '{}';

COMMENT ON COLUMN orders.delivery_confirmed_at IS 'Thời điểm xác nhận giao hàng thành công';
COMMENT ON COLUMN orders.delivery_photos       IS 'Danh sách URL ảnh giao hàng — lưu Supabase Storage bucket task-attachments';
