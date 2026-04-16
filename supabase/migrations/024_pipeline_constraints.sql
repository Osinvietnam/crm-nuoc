-- ============================================================
-- Migration 024: Pipeline value constraints
-- Date: 2026-04-16
-- Issues fixed:
--   H1 — Không có CHECK constraint giá trị pipeline (audit C1/H1)
--   H12 — Cho phép nhiều BG "Chấp nhận" cùng 1 KH
-- Note: DB-level transition trigger (C1 đầy đủ) sẽ thêm sau
--       khi toàn bộ API đã enforce transition ở app layer.
-- ============================================================

-- ── 1. CHECK constraint giá trị pipeline ─────────────────────
-- Chặn insert/update giá trị tùy ý (ví dụ: typo, bug API trả về unknown stage).
-- Nếu có bản ghi pipeline khác 10 giá trị trên → migration fail và rollback.
-- Chạy trước: SELECT DISTINCT pipeline FROM customers; để kiểm tra.
ALTER TABLE customers
  ADD CONSTRAINT chk_pipeline_valid
  CHECK (pipeline IN (
    'Lead mới',
    'Tiềm năng',
    'Báo giá',
    'Đàm phán',
    'Chốt HĐ',
    'Giao hàng',
    'Nghiệm thu',
    'Bảo hành',
    'Bảo trì',
    'Lost'
  ));

-- ── 2. UNIQUE: tối đa 1 BG "Chấp nhận" trên mỗi KH ──────────
-- Ngăn tình trạng nhiều BG cùng "Chấp nhận" → không biết BG nào thành HĐ.
-- Nếu đã có KH với 2+ BG Chấp nhận → migration fail.
-- Chạy trước: SELECT customer_id, COUNT(*) FROM quotes
--             WHERE trang_thai = 'Chấp nhận' AND customer_id IS NOT NULL
--             GROUP BY customer_id HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_accepted_quote_per_customer
  ON quotes (customer_id)
  WHERE trang_thai = 'Chấp nhận'
    AND customer_id IS NOT NULL;

-- ── Xác nhận sau khi chạy ────────────────────────────────────
-- SELECT conname, consrc FROM pg_constraint WHERE conrelid = 'customers'::regclass;
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'quotes' AND indexname LIKE 'uniq%';
