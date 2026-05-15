-- Migration 080: Add commission columns to orders table
-- Created: 2026-05-15

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS hh_phan_tram  NUMERIC(5,2),      -- % hoa hồng (null = không có hoa hồng)
  ADD COLUMN IF NOT EXISTS hh_kinh_doanh NUMERIC(15,2),     -- tiền hoa hồng kinh doanh (VNĐ)
  ADD COLUMN IF NOT EXISTS hh_da_tra     BOOLEAN NOT NULL DEFAULT false,  -- đã trả hoa hồng chưa
  ADD COLUMN IF NOT EXISTS hh_ngay_tra   DATE;              -- ngày trả hoa hồng
