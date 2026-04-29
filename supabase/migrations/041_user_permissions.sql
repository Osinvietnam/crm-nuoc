-- ─── Migration 041: user_permissions — quyền riêng cho từng nhân viên ─────────
-- Chạy trong Supabase SQL Editor
--
-- Logic:
--   - Mỗi nhân viên có bộ quyền riêng (user_permissions)
--   - Khi tạo mới → trigger tự seed từ role_permissions của role đó
--   - Khi đổi role → trigger reset về mặc định role mới
--   - Admin có thể tùy chỉnh từng nhân viên qua UI

-- ─── 1. Bảng user_permissions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  is_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, permission_key)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- User tự xem quyền của mình; admin/ceo xem tất cả
DROP POLICY IF EXISTS "up_select" ON user_permissions;
CREATE POLICY "up_select" ON user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR get_my_role() IN ('admin', 'ceo', 'director'));

-- Chỉ admin mới sửa
DROP POLICY IF EXISTS "up_admin_write" ON user_permissions;
CREATE POLICY "up_admin_write" ON user_permissions
  FOR ALL USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE INDEX IF NOT EXISTS idx_up_lookup ON user_permissions(user_id, permission_key, is_enabled);

-- ─── 2. Trigger: auto-seed khi tạo profile mới ────────────────────────────────

CREATE OR REPLACE FUNCTION fn_seed_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_permissions (user_id, permission_key, is_enabled)
  SELECT NEW.id, rp.permission_key, rp.is_enabled
  FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id
  WHERE r.code = NEW.role
  ON CONFLICT (user_id, permission_key) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_user_permissions ON profiles;
CREATE TRIGGER trg_seed_user_permissions
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_seed_user_permissions();

-- ─── 3. Trigger: reset khi đổi role ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_reseed_on_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Xóa quyền cũ và seed lại từ role mới
    DELETE FROM user_permissions WHERE user_id = NEW.id;
    INSERT INTO user_permissions (user_id, permission_key, is_enabled)
    SELECT NEW.id, rp.permission_key, rp.is_enabled
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    WHERE r.code = NEW.role
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reseed_on_role_change ON profiles;
CREATE TRIGGER trg_reseed_on_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_reseed_on_role_change();

-- ─── 4. Seed tất cả user hiện có (idempotent) ────────────────────────────────

INSERT INTO user_permissions (user_id, permission_key, is_enabled)
SELECT p.id, rp.permission_key, rp.is_enabled
FROM profiles p
JOIN roles r ON r.code = p.role
JOIN role_permissions rp ON rp.role_id = r.id
WHERE p.is_active = TRUE
ON CONFLICT (user_id, permission_key) DO NOTHING;

-- ─── 5. Xác nhận kết quả ─────────────────────────────────────────────────────

SELECT
  p.full_name,
  p.role,
  COUNT(*) FILTER (WHERE up.is_enabled) AS enabled_perms,
  COUNT(*)                              AS total_perms
FROM profiles p
JOIN user_permissions up ON up.user_id = p.id
WHERE p.is_active = TRUE
GROUP BY p.full_name, p.role
ORDER BY p.role, p.full_name;
