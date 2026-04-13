-- ─── Lịch sử thay đổi Pipeline ───────────────────────────────────────────────
-- Tự động insert mỗi khi customer.pipeline thay đổi (trigger) hoặc qua API

CREATE TABLE pipeline_history (
  id           BIGSERIAL PRIMARY KEY,
  customer_id  BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  from_stage   TEXT,                                -- NULL nếu là lần đầu tạo KH
  to_stage     TEXT NOT NULL,
  changed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes        TEXT
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_pipeline_history_customer_id ON pipeline_history(customer_id);
CREATE INDEX idx_pipeline_history_changed_at  ON pipeline_history(changed_at);
CREATE INDEX idx_pipeline_history_to_stage    ON pipeline_history(to_stage);

-- ─── Trigger tự động ghi lịch sử khi pipeline thay đổi ──────────────────────

CREATE OR REPLACE FUNCTION log_pipeline_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.pipeline IS DISTINCT FROM NEW.pipeline THEN
    INSERT INTO pipeline_history (customer_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.pipeline, NEW.pipeline, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pipeline_history
  AFTER UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION log_pipeline_change();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE pipeline_history ENABLE ROW LEVEL SECURITY;

-- SELECT: ai thấy được KH thì thấy được lịch sử pipeline của KH đó
CREATE POLICY "pipeline_history_select" ON pipeline_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = customer_id
    -- Kế thừa điều kiện từ customers_select:
    AND (
      get_my_role() IN ('admin', 'ceo', 'accountant', 'tech_lead', 'logistics')
      OR (get_my_role() = 'sales' AND c.nguoi_phu_trach = auth.uid())
      OR (get_my_role() = 'tech'  AND c.khu_vuc = get_my_khu_vuc())
    )
  )
);

-- INSERT: chỉ qua trigger (không cho app insert trực tiếp)
-- Nếu cần insert thủ công (admin), mở thêm policy bên dưới
CREATE POLICY "pipeline_history_insert_admin" ON pipeline_history FOR INSERT WITH CHECK (
  get_my_role() IN ('admin', 'ceo')
);

-- Không cho UPDATE hay DELETE lịch sử
CREATE POLICY "pipeline_history_no_update" ON pipeline_history FOR UPDATE USING (FALSE);
CREATE POLICY "pipeline_history_no_delete" ON pipeline_history FOR DELETE USING (FALSE);
