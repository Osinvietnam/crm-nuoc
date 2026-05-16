-- Migration 065: Thêm cột hinh_anh vào maintenance_construction
-- Cột này đã được dùng trong photos API nhưng chưa có trong schema

ALTER TABLE maintenance_construction
  ADD COLUMN IF NOT EXISTS hinh_anh TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN maintenance_construction.hinh_anh IS 'Danh sách URL ảnh công trình (Supabase Storage: task-attachments/)';
