-- migration 044: thêm nguoi_phu_trach_id (UUID) vào payment_records
-- Lý do: cột nguoi_phu_trach cũ là TEXT (full_name) — đổi tên NV sẽ mất liên kết doanh thu
-- Backfill không thực hiện vì TEXT column có thể không nhất quán; dữ liệu mới sẽ set UUID tự động

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS nguoi_phu_trach_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_records_owner_id ON payment_records(nguoi_phu_trach_id);

COMMENT ON COLUMN payment_records.nguoi_phu_trach_id IS 'FK → profiles.id — dùng cho KPI và report queries. Payment mới sẽ tự set từ customers.nguoi_phu_trach';
