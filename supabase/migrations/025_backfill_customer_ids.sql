-- Migration 025: Backfill customer_id in task_completions and payment_records
-- Uses lark_record_id → customers.id lookup

-- Backfill task_completions.customer_id từ customer_record_id (Lark record ID)
UPDATE task_completions tc
SET customer_id = c.id
FROM customers c
WHERE c.lark_record_id = tc.customer_record_id
  AND tc.customer_id IS NULL;

-- Backfill payment_records.customer_id
UPDATE payment_records pr
SET customer_id = c.id
FROM customers c
WHERE c.lark_record_id = pr.customer_record_id
  AND pr.customer_id IS NULL;

-- Verification queries (run manually to confirm):
-- SELECT COUNT(*) FROM task_completions WHERE customer_id IS NULL AND customer_record_id IS NOT NULL;
-- SELECT COUNT(*) FROM payment_records  WHERE customer_id IS NULL AND customer_record_id IS NOT NULL;
-- Expected: both should return 0 after migration succeeds.
