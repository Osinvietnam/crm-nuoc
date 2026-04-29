-- 048: Siết RLS audit_logs — chỉ service role INSERT được; authenticated chỉ SELECT

-- Xóa policy INSERT quá rộng (mọi authenticated user đều INSERT được — nguy cơ inject fake log)
DROP POLICY IF EXISTS "authenticated_insert_audit" ON audit_logs;

-- SELECT giữ nguyên (authenticated đọc được — UI admin/ceo/director filter ở app level)
-- Không cần tạo lại vì policy "authenticated_read_audit" đã có từ migration 005

-- Từ đây logAudit() phải dùng createServiceClient() để bypass RLS
-- (đã cập nhật trong lib/audit.ts cùng commit này)
