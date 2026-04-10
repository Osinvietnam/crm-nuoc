-- 011: Payment records — theo dõi thanh toán 3 đợt per khách hàng
--      Mirror song song với LarkBase PAYMENTS table (tbltKdcqLIWKX0JA)

CREATE TABLE payment_records (
  id                 BIGSERIAL PRIMARY KEY,
  customer_record_id TEXT NOT NULL,          -- LarkBase customer record_id
  customer_name      TEXT,                   -- Tên KH (cache để hiển thị nhanh)
  nguoi_phu_trach    TEXT,                   -- Sales phụ trách (dùng tính KPI)
  contract_record_id TEXT,                   -- LarkBase contract record_id (nếu có)
  installment        INT NOT NULL CHECK (installment IN (1, 2, 3)),
  percent            INT CHECK (percent BETWEEN 1 AND 100),  -- 60, 35, 5
  amount             BIGINT,                 -- Số tiền thực tế (VNĐ)
  due_date           DATE,                   -- Ngày dự kiến TT
  paid_date          DATE,                   -- Ngày TT thực tế
  is_paid            BOOLEAN NOT NULL DEFAULT FALSE,
  lark_record_id     TEXT,                   -- record_id trong LarkBase PAYMENTS table
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_record_id, installment)
);

CREATE INDEX ON payment_records(customer_record_id);
CREATE INDEX ON payment_records(nguoi_phu_trach);
CREATE INDEX ON payment_records(paid_date) WHERE is_paid = true;

ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage payment records"
  ON payment_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE payment_records IS 'Thanh toán 3 đợt per KH: 60% ký HĐ / 35% trước giao hàng / 5% sau nghiệm thu';
COMMENT ON COLUMN payment_records.lark_record_id IS 'record_id tương ứng trong LarkBase PAYMENTS table để sync';
