-- Migration 064: liên kết payment_records với orders (Supabase ID)
-- Để Sales lọc được đợt thanh toán của đơn hàng mình phụ trách

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_records_order_id
  ON payment_records(order_id)
  WHERE order_id IS NOT NULL;

COMMENT ON COLUMN payment_records.order_id IS 'FK → orders.id — liên kết TT với đơn hàng Supabase để lọc theo nguoi_phu_trach';
