-- ============================================================
-- Migration 020: Fix RLS security holes
-- Date: 2026-04-15
-- Issues fixed:
--   1. Drop legacy "auth users" (FOR ALL USING true) from
--      kpi_targets, payment_records, task_completions
--      (these override the granular policies added later)
--   2. Restrict company_settings UPDATE to admin/ceo only
--   3. Drop 3 legacy link tables (no longer used — LarkBase era)
-- ============================================================

-- ── 1. kpi_targets — drop legacy permissive policy ──────────
DROP POLICY IF EXISTS "auth users" ON kpi_targets;

-- ── 2. payment_records — drop legacy permissive policy ──────
DROP POLICY IF EXISTS "auth users" ON payment_records;
-- Also drop the old policy created in migration 011 (if still present)
DROP POLICY IF EXISTS "authenticated users can manage payment records" ON payment_records;

-- ── 3. task_completions — drop legacy permissive policy ──────
DROP POLICY IF EXISTS "auth users" ON task_completions;

-- ── 4. company_settings — restrict UPDATE to admin/ceo ───────
-- Drop both the old open-to-all policy AND the new one (idempotent re-run)
DROP POLICY IF EXISTS "authenticated_write_company" ON company_settings;
DROP POLICY IF EXISTS "admin_write_company"         ON company_settings;

-- Re-create restricted: only admin/ceo can write
CREATE POLICY "admin_write_company"
  ON company_settings
  FOR ALL
  TO authenticated
  USING     (get_my_role() = ANY (ARRAY['admin', 'ceo']))
  WITH CHECK (get_my_role() = ANY (ARRAY['admin', 'ceo']));

-- ── 5. Drop 3 legacy link tables (LarkBase era, no longer used) ──
-- If these tables ARE still used, comment out the DROP and
-- replace with restricted policies below instead.
DROP TABLE IF EXISTS contract_customer_links     CASCADE;
DROP TABLE IF EXISTS construction_contract_links CASCADE;
DROP TABLE IF EXISTS quote_customer_links        CASCADE;

-- ── Verification query (run after applying) ──────────────────
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN (
--   'kpi_targets', 'payment_records', 'task_completions',
--   'company_settings', 'system_config', 'audit_logs'
-- )
-- ORDER BY tablename, policyname;
