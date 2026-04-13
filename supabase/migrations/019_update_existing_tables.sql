-- ─── Cập nhật các bảng cũ để liên kết với customers mới ─────────────────────
-- Thêm customer_id (FK) vào task_completions và payment_records
-- Giữ nguyên customer_record_id (TEXT) để không phá vỡ code hiện tại
-- Sau khi migration script chạy xong, customer_id sẽ được populate

-- ── task_completions ─────────────────────────────────────────────────────────

ALTER TABLE task_completions
  ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_task_completions_customer_id
  ON task_completions(customer_id);

-- ── payment_records ───────────────────────────────────────────────────────────

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payment_records_customer_id
  ON payment_records(customer_id);

-- ── kpi_targets: thêm updated_at nếu chưa có ─────────────────────────────────

ALTER TABLE kpi_targets
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─── RLS bổ sung cho payment_records (theo khu_vuc) ─────────────────────────
-- Drop policy cũ (using true) rồi tạo lại đúng hơn

DROP POLICY IF EXISTS "authenticated users can manage payment_records" ON payment_records;

ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_records_select" ON payment_records FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'accountant', 'tech_lead')
  OR (get_my_role() = 'sales' AND (
    nguoi_phu_trach = (SELECT full_name FROM profiles WHERE id = auth.uid())
    OR (customer_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM customers c WHERE c.id = customer_id AND c.nguoi_phu_trach = auth.uid()
    ))
  ))
);

CREATE POLICY "payment_records_write" ON payment_records FOR ALL USING (
  get_my_role() IN ('admin', 'ceo', 'accountant')
) WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'accountant')
);

-- ─── RLS bổ sung cho task_completions ────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated users can manage task_completions" ON task_completions;

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- Ai thấy KH thì thấy task của KH đó
CREATE POLICY "task_completions_select" ON task_completions FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'accountant', 'tech_lead', 'logistics')
  OR (customer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM customers c WHERE c.id = customer_id
    AND (
      (get_my_role() = 'sales' AND c.nguoi_phu_trach = auth.uid())
      OR (get_my_role() = 'tech'  AND c.khu_vuc = get_my_khu_vuc())
    )
  ))
);

-- Ai có thể complete task: theo roles_can_complete (kiểm soát ở app, RLS chỉ check login)
CREATE POLICY "task_completions_write" ON task_completions FOR ALL USING (
  auth.uid() IS NOT NULL
) WITH CHECK (
  auth.uid() IS NOT NULL
);

-- ─── RLS bổ sung cho kpi_targets ─────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated users can manage kpi_targets" ON kpi_targets;

ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_targets_select" ON kpi_targets FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo')
  OR user_id = auth.uid()       -- nhân viên tự xem của mình
);

CREATE POLICY "kpi_targets_write" ON kpi_targets FOR ALL USING (
  get_my_role() IN ('admin', 'ceo')
) WITH CHECK (
  get_my_role() IN ('admin', 'ceo')
);
