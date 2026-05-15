-- Migration 076: Cho phép Director xem KPI targets (đồng bộ với app logic)
-- API /api/kpi/me và /api/admin/kpi đã cho Director xem dữ liệu người khác
-- nhưng RLS kpi_targets_select chỉ allow admin + ceo → Director bị block

DROP POLICY IF EXISTS "kpi_targets_select" ON kpi_targets;

CREATE POLICY "kpi_targets_select" ON kpi_targets FOR SELECT USING (
  get_my_role() IN ('admin', 'ceo', 'director')  -- managers thấy tất cả
  OR user_id = auth.uid()                         -- nhân viên tự xem của mình
);

-- Ghi chú: policy write (INSERT/UPDATE/DELETE) vẫn chỉ admin + ceo
-- Director chỉ được XEM, không được đặt target
