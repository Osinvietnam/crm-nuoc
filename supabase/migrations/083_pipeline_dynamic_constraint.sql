-- Migration 083: Thay CHECK constraint cứng bằng trigger validate động
-- Lý do: CHECK constraint cũ hardcode 10 labels → admin đổi tên stage → DB reject update
-- Trigger mới validate customers.pipeline so với stage_labels của bất kỳ pipeline_config active nào

-- ── 1. Xoá CHECK constraint cũ ───────────────────────────────────────────────
ALTER TABLE customers DROP CONSTRAINT IF EXISTS chk_pipeline_valid;

-- ── 2. Trigger function — validate pipeline value động ───────────────────────
CREATE OR REPLACE FUNCTION fn_validate_customer_pipeline()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- NULL pipeline hợp lệ (KH chưa phân loại)
  IF NEW.pipeline IS NULL THEN RETURN NEW; END IF;
  -- 'Lost' luôn hợp lệ (terminal stage, không có trong stage_labels)
  IF NEW.pipeline = 'Lost' THEN RETURN NEW; END IF;

  -- Kiểm tra giá trị có tồn tại trong bất kỳ pipeline_configs active nào không
  IF NOT EXISTS (
    SELECT 1
    FROM   pipeline_configs
    WHERE  is_active = true
    AND    NEW.pipeline = ANY(stage_labels)
  ) THEN
    RAISE EXCEPTION 'pipeline value "%" không hợp lệ. Phải là một trong các stage label đang active trong pipeline_configs.', NEW.pipeline
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_validate_customer_pipeline IS
  'Validate customers.pipeline value động so với pipeline_configs.stage_labels — thay cho CHECK constraint cứng';

-- ── 3. Gắn trigger vào customers ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_validate_customer_pipeline ON customers;

CREATE TRIGGER trg_validate_customer_pipeline
  BEFORE INSERT OR UPDATE OF pipeline ON customers
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_customer_pipeline();

-- ── Xác nhận ─────────────────────────────────────────────────────────────────
-- SELECT trigger_name, event_manipulation FROM information_schema.triggers
-- WHERE event_object_table = 'customers' AND trigger_name LIKE '%pipeline%';
