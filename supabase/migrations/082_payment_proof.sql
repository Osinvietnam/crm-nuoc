-- Migration 082: Payment Proof (chứng từ thanh toán)
-- Thêm cột proof_url vào payment_records + tạo storage bucket payment-proofs

-- Cột lưu URL chứng từ (ảnh chụp, PDF chuyển khoản...)
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- Storage bucket payment-proofs (public read, upload qua service role)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Cho phép user đã xác thực đọc (bucket public nên SELECT không cần policy)
-- Chỉ cho phép upload qua service role (API server) — không cần RLS policy INSERT
