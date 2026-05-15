-- Migration 078: DB helper function advance_customer_pipeline
-- Chỉ advance pipeline nếu stage mới cao hơn stage hiện tại (không bao giờ lùi)

CREATE OR REPLACE FUNCTION advance_customer_pipeline(
  p_customer_id BIGINT,
  p_new_stage   TEXT
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  stage_order TEXT[] := ARRAY[
    'Lead mới','Tiềm năng','Báo giá','Đàm phán',
    'Chốt HĐ','Giao hàng','Nghiệm thu','Bảo hành','Bảo trì'
  ];
BEGIN
  UPDATE customers
  SET pipeline = p_new_stage
  WHERE id = p_customer_id
    AND array_position(stage_order, p_new_stage) >
        array_position(stage_order, pipeline);
END;
$$;

COMMENT ON FUNCTION advance_customer_pipeline IS
  'Chỉ update pipeline nếu stage mới cao hơn hiện tại — không bao giờ đẩy lùi';
