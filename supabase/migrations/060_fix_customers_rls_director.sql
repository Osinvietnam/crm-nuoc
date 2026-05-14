-- ─── Migration 060: Fix RLS customers_insert — thêm Director ────────────────
-- Vấn đề: customers_insert chỉ cho admin/ceo và sales (của mình)
-- Director bị chặn ở RLS dù API route đã cho phép → rewrite toàn bộ import sẽ fail
-- Fix: thêm 'director' vào INSERT policy
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "customers_insert" ON customers;

CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'director')
  OR (get_my_role() = 'sales' AND nguoi_phu_trach = auth.uid())
);

-- ─── Xác nhận ────────────────────────────────────────────────────────────────
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'customers'
ORDER BY cmd, policyname;
