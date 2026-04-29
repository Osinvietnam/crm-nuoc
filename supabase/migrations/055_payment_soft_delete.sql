-- Migration 055: Soft-delete + created_by cho payment_records
-- FIN-03: soft-delete thay vì hard delete
-- ACC-07 (FIN): accountant xóa payment nếu is_paid=false AND created_by=me.id

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS created_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL NULL;

CREATE INDEX IF NOT EXISTS idx_payment_records_active
  ON payment_records(customer_record_id) WHERE deleted_at IS NULL;
