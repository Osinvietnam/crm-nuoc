-- Migration 063: thêm scheduled_date vào warranty_tickets
-- Cho phép KTV lên lịch ngày xử lý → hiển thị trên Calendar

ALTER TABLE warranty_tickets
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS scheduled_note TEXT;   -- ghi chú lịch hẹn (tuỳ chọn)

CREATE INDEX IF NOT EXISTS idx_wtickets_scheduled
  ON warranty_tickets(scheduled_date)
  WHERE scheduled_date IS NOT NULL;

COMMENT ON COLUMN warranty_tickets.scheduled_date IS 'Ngày KTV lên lịch xuất phát/xử lý — hiển thị trên Calendar';
COMMENT ON COLUMN warranty_tickets.scheduled_note IS 'Ghi chú lịch hẹn (thời gian, địa điểm...)';
