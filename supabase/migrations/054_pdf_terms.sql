-- Migration 054: Điều khoản PDF cho báo giá + hợp đồng (TPL-03, TPL-09, DOC-06, DOC-10)

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS quote_terms              TEXT,
  ADD COLUMN IF NOT EXISTS contract_payment_terms   TEXT,
  ADD COLUMN IF NOT EXISTS contract_terms           TEXT;
