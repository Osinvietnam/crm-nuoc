-- Migration 081: Add director to payment_records_write RLS policy
-- Created: 2026-05-15

DROP POLICY IF EXISTS "payment_records_write" ON payment_records;

CREATE POLICY "payment_records_write" ON payment_records
FOR ALL USING (
  get_my_role() IN ('admin', 'ceo', 'accountant', 'director')
) WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'accountant', 'director')
);
