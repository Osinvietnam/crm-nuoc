-- H8: Unique constraint cho (customer_id, phien_ban)
-- Chỉ áp dụng khi customer_id NOT NULL (partial index)
-- Trước khi chạy: nếu có duplicate versions, chạy dedup bên dưới trước.

-- Bước dedup (chạy nếu cần): tìm duplicate
-- SELECT customer_id, phien_ban, COUNT(*) FROM quotes
-- WHERE customer_id IS NOT NULL
-- GROUP BY customer_id, phien_ban HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_quote_version_per_customer
  ON quotes (customer_id, phien_ban)
  WHERE customer_id IS NOT NULL;
