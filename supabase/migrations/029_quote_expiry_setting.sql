-- M3: Thêm cài đặt số ngày hết hạn báo giá (default 14)
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS quote_expiry_days INT DEFAULT 14;
