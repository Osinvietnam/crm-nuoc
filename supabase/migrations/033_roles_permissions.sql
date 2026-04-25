-- 033: roles + role_permissions — hệ thống phân quyền động, Admin toggle qua UI

-- ─── 1. Bảng roles ────────────────────────────────────────────────────────────

CREATE TABLE roles (
  id           BIGSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,   -- 'admin','ceo','director','sales'...
  display_name TEXT NOT NULL,
  description  TEXT,
  is_system    BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = không xóa được
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_write" ON roles
  FOR ALL USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

COMMENT ON TABLE roles IS 'Định nghĩa vai trò nhân viên — Admin quản lý qua UI';
COMMENT ON COLUMN roles.is_system IS 'TRUE = role hệ thống, không được xóa';

-- ─── 2. Bảng role_permissions ─────────────────────────────────────────────────

CREATE TABLE role_permissions (
  role_id        BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key TEXT   NOT NULL,
  is_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_key)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rp_select" ON role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rp_admin_write" ON role_permissions
  FOR ALL USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

COMMENT ON TABLE role_permissions IS 'Ma trận quyền — Admin tích checkbox trong UI để bật/tắt';
COMMENT ON COLUMN role_permissions.permission_key IS
  'VIEW_ALL_CUSTOMERS | VIEW_REGION_CUSTOMERS | VIEW_OWN_CUSTOMERS | VIEW_FINANCIAL_DATA |
   CREATE_CUSTOMER | MANAGE_CUSTOMER |
   CREATE_QUOTE | APPROVE_QUOTE |
   CREATE_CONTRACT | APPROVE_CONTRACT |
   COLLECT_PAYMENT | APPROVE_DISCOUNT |
   START_TASK | COMPLETE_OWN_TASK | APPROVE_OTHERS_TASK | MANAGE_BLOCKED_TASK |
   VIEW_ALL_KPI | MANAGE_USERS | EDIT_SYSTEM_SETTINGS | EDIT_TASK_DEFINITIONS';

-- ─── 3. Seed: 8 roles ─────────────────────────────────────────────────────────

INSERT INTO roles (code, display_name, description, is_system, sort_order) VALUES
  ('admin',      'Quản trị hệ thống',      'Toàn quyền hệ thống',                             TRUE,  10),
  ('ceo',        'Giám đốc / CEO',          'Duyệt hợp đồng, xem toàn bộ dữ liệu',             TRUE,  20),
  ('director',   'Phó Giám đốc',            'Quản lý khu vực + duyệt task + ký HĐ dưới ngưỡng',TRUE,  30),
  ('accountant', 'Kế toán',                 'Xác nhận thanh toán, review HĐ',                   TRUE,  40),
  ('sales',      'Nhân viên Kinh doanh',    'Tạo KH, báo giá, soạn HĐ, chăm sóc KH',           TRUE,  50),
  ('tech',       'Kỹ thuật viên',           'Khảo sát, lắp đặt, bảo hành, bảo trì',             TRUE,  60),
  ('logistics',  'Kho / Vận chuyển',        'Kiểm kho, xuất kho, giao hàng',                    TRUE,  70),
  ('partner',    'Đối tác',                 'Xem KH do mình giới thiệu, tạo KH mới',             TRUE,  80);

-- ─── 4. Seed: permission matrix ───────────────────────────────────────────────
-- Dùng CTE để insert gọn gàng

WITH role_ids AS (
  SELECT id, code FROM roles
),
perms (role_code, pkey, enabled) AS (VALUES
  -- ── admin: toàn quyền ──────────────────────────────────────────────────────
  ('admin','VIEW_ALL_CUSTOMERS',TRUE),
  ('admin','VIEW_REGION_CUSTOMERS',TRUE),
  ('admin','VIEW_OWN_CUSTOMERS',TRUE),
  ('admin','VIEW_FINANCIAL_DATA',TRUE),
  ('admin','CREATE_CUSTOMER',TRUE),
  ('admin','MANAGE_CUSTOMER',TRUE),
  ('admin','CREATE_QUOTE',TRUE),
  ('admin','APPROVE_QUOTE',TRUE),
  ('admin','CREATE_CONTRACT',TRUE),
  ('admin','APPROVE_CONTRACT',TRUE),
  ('admin','COLLECT_PAYMENT',TRUE),
  ('admin','APPROVE_DISCOUNT',TRUE),
  ('admin','START_TASK',TRUE),
  ('admin','COMPLETE_OWN_TASK',TRUE),
  ('admin','APPROVE_OTHERS_TASK',TRUE),
  ('admin','MANAGE_BLOCKED_TASK',TRUE),
  ('admin','VIEW_ALL_KPI',TRUE),
  ('admin','MANAGE_USERS',TRUE),
  ('admin','EDIT_SYSTEM_SETTINGS',TRUE),
  ('admin','EDIT_TASK_DEFINITIONS',TRUE),

  -- ── ceo: gần như admin, không edit system ─────────────────────────────────
  ('ceo','VIEW_ALL_CUSTOMERS',TRUE),
  ('ceo','VIEW_REGION_CUSTOMERS',TRUE),
  ('ceo','VIEW_OWN_CUSTOMERS',TRUE),
  ('ceo','VIEW_FINANCIAL_DATA',TRUE),
  ('ceo','CREATE_CUSTOMER',TRUE),
  ('ceo','MANAGE_CUSTOMER',TRUE),
  ('ceo','CREATE_QUOTE',TRUE),
  ('ceo','APPROVE_QUOTE',TRUE),
  ('ceo','CREATE_CONTRACT',TRUE),
  ('ceo','APPROVE_CONTRACT',TRUE),
  ('ceo','COLLECT_PAYMENT',TRUE),
  ('ceo','APPROVE_DISCOUNT',TRUE),
  ('ceo','START_TASK',TRUE),
  ('ceo','COMPLETE_OWN_TASK',TRUE),
  ('ceo','APPROVE_OTHERS_TASK',TRUE),
  ('ceo','MANAGE_BLOCKED_TASK',TRUE),
  ('ceo','VIEW_ALL_KPI',TRUE),
  ('ceo','MANAGE_USERS',TRUE),
  ('ceo','EDIT_SYSTEM_SETTINGS',FALSE),
  ('ceo','EDIT_TASK_DEFINITIONS',FALSE),

  -- ── director: gộp Phó GĐ + Tech Lead ─────────────────────────────────────
  ('director','VIEW_ALL_CUSTOMERS',TRUE),
  ('director','VIEW_REGION_CUSTOMERS',TRUE),
  ('director','VIEW_OWN_CUSTOMERS',TRUE),
  ('director','VIEW_FINANCIAL_DATA',TRUE),
  ('director','CREATE_CUSTOMER',TRUE),
  ('director','MANAGE_CUSTOMER',TRUE),
  ('director','CREATE_QUOTE',TRUE),
  ('director','APPROVE_QUOTE',TRUE),
  ('director','CREATE_CONTRACT',TRUE),
  ('director','APPROVE_CONTRACT',TRUE),
  ('director','COLLECT_PAYMENT',TRUE),
  ('director','APPROVE_DISCOUNT',TRUE),
  ('director','START_TASK',TRUE),
  ('director','COMPLETE_OWN_TASK',TRUE),
  ('director','APPROVE_OTHERS_TASK',TRUE),
  ('director','MANAGE_BLOCKED_TASK',TRUE),
  ('director','VIEW_ALL_KPI',TRUE),
  ('director','MANAGE_USERS',TRUE),
  ('director','EDIT_SYSTEM_SETTINGS',FALSE),
  ('director','EDIT_TASK_DEFINITIONS',FALSE),

  -- ── accountant ────────────────────────────────────────────────────────────
  ('accountant','VIEW_ALL_CUSTOMERS',TRUE),
  ('accountant','VIEW_REGION_CUSTOMERS',TRUE),
  ('accountant','VIEW_OWN_CUSTOMERS',TRUE),
  ('accountant','VIEW_FINANCIAL_DATA',TRUE),
  ('accountant','CREATE_CUSTOMER',FALSE),
  ('accountant','MANAGE_CUSTOMER',FALSE),
  ('accountant','CREATE_QUOTE',FALSE),
  ('accountant','APPROVE_QUOTE',FALSE),
  ('accountant','CREATE_CONTRACT',TRUE),
  ('accountant','APPROVE_CONTRACT',FALSE),
  ('accountant','COLLECT_PAYMENT',TRUE),
  ('accountant','APPROVE_DISCOUNT',FALSE),
  ('accountant','START_TASK',TRUE),
  ('accountant','COMPLETE_OWN_TASK',TRUE),
  ('accountant','APPROVE_OTHERS_TASK',FALSE),
  ('accountant','MANAGE_BLOCKED_TASK',FALSE),
  ('accountant','VIEW_ALL_KPI',TRUE),
  ('accountant','MANAGE_USERS',FALSE),
  ('accountant','EDIT_SYSTEM_SETTINGS',FALSE),
  ('accountant','EDIT_TASK_DEFINITIONS',FALSE),

  -- ── sales ─────────────────────────────────────────────────────────────────
  ('sales','VIEW_ALL_CUSTOMERS',FALSE),
  ('sales','VIEW_REGION_CUSTOMERS',FALSE),
  ('sales','VIEW_OWN_CUSTOMERS',TRUE),
  ('sales','VIEW_FINANCIAL_DATA',FALSE),
  ('sales','CREATE_CUSTOMER',TRUE),
  ('sales','MANAGE_CUSTOMER',TRUE),
  ('sales','CREATE_QUOTE',TRUE),
  ('sales','APPROVE_QUOTE',FALSE),
  ('sales','CREATE_CONTRACT',TRUE),
  ('sales','APPROVE_CONTRACT',FALSE),
  ('sales','COLLECT_PAYMENT',TRUE),
  ('sales','APPROVE_DISCOUNT',FALSE),
  ('sales','START_TASK',TRUE),
  ('sales','COMPLETE_OWN_TASK',TRUE),
  ('sales','APPROVE_OTHERS_TASK',FALSE),
  ('sales','MANAGE_BLOCKED_TASK',FALSE),
  ('sales','VIEW_ALL_KPI',FALSE),
  ('sales','MANAGE_USERS',FALSE),
  ('sales','EDIT_SYSTEM_SETTINGS',FALSE),
  ('sales','EDIT_TASK_DEFINITIONS',FALSE),

  -- ── tech ──────────────────────────────────────────────────────────────────
  ('tech','VIEW_ALL_CUSTOMERS',FALSE),
  ('tech','VIEW_REGION_CUSTOMERS',TRUE),
  ('tech','VIEW_OWN_CUSTOMERS',TRUE),
  ('tech','VIEW_FINANCIAL_DATA',FALSE),
  ('tech','CREATE_CUSTOMER',FALSE),
  ('tech','MANAGE_CUSTOMER',FALSE),
  ('tech','CREATE_QUOTE',FALSE),
  ('tech','APPROVE_QUOTE',FALSE),
  ('tech','CREATE_CONTRACT',FALSE),
  ('tech','APPROVE_CONTRACT',FALSE),
  ('tech','COLLECT_PAYMENT',FALSE),
  ('tech','APPROVE_DISCOUNT',FALSE),
  ('tech','START_TASK',TRUE),
  ('tech','COMPLETE_OWN_TASK',TRUE),
  ('tech','APPROVE_OTHERS_TASK',FALSE),
  ('tech','MANAGE_BLOCKED_TASK',FALSE),
  ('tech','VIEW_ALL_KPI',FALSE),
  ('tech','MANAGE_USERS',FALSE),
  ('tech','EDIT_SYSTEM_SETTINGS',FALSE),
  ('tech','EDIT_TASK_DEFINITIONS',FALSE),

  -- ── logistics ─────────────────────────────────────────────────────────────
  ('logistics','VIEW_ALL_CUSTOMERS',FALSE),
  ('logistics','VIEW_REGION_CUSTOMERS',TRUE),
  ('logistics','VIEW_OWN_CUSTOMERS',TRUE),
  ('logistics','VIEW_FINANCIAL_DATA',FALSE),
  ('logistics','CREATE_CUSTOMER',FALSE),
  ('logistics','MANAGE_CUSTOMER',FALSE),
  ('logistics','CREATE_QUOTE',FALSE),
  ('logistics','APPROVE_QUOTE',FALSE),
  ('logistics','CREATE_CONTRACT',FALSE),
  ('logistics','APPROVE_CONTRACT',FALSE),
  ('logistics','COLLECT_PAYMENT',FALSE),
  ('logistics','APPROVE_DISCOUNT',FALSE),
  ('logistics','START_TASK',TRUE),
  ('logistics','COMPLETE_OWN_TASK',TRUE),
  ('logistics','APPROVE_OTHERS_TASK',FALSE),
  ('logistics','MANAGE_BLOCKED_TASK',FALSE),
  ('logistics','VIEW_ALL_KPI',FALSE),
  ('logistics','MANAGE_USERS',FALSE),
  ('logistics','EDIT_SYSTEM_SETTINGS',FALSE),
  ('logistics','EDIT_TASK_DEFINITIONS',FALSE),

  -- ── partner: chỉ xem KH mình GT, tạo KH mới ──────────────────────────────
  ('partner','VIEW_ALL_CUSTOMERS',FALSE),
  ('partner','VIEW_REGION_CUSTOMERS',FALSE),
  ('partner','VIEW_OWN_CUSTOMERS',TRUE),
  ('partner','VIEW_FINANCIAL_DATA',FALSE),
  ('partner','CREATE_CUSTOMER',TRUE),
  ('partner','MANAGE_CUSTOMER',FALSE),
  ('partner','CREATE_QUOTE',FALSE),
  ('partner','APPROVE_QUOTE',FALSE),
  ('partner','CREATE_CONTRACT',FALSE),
  ('partner','APPROVE_CONTRACT',FALSE),
  ('partner','COLLECT_PAYMENT',FALSE),
  ('partner','APPROVE_DISCOUNT',FALSE),
  ('partner','START_TASK',FALSE),
  ('partner','COMPLETE_OWN_TASK',FALSE),
  ('partner','APPROVE_OTHERS_TASK',FALSE),
  ('partner','MANAGE_BLOCKED_TASK',FALSE),
  ('partner','VIEW_ALL_KPI',FALSE),
  ('partner','MANAGE_USERS',FALSE),
  ('partner','EDIT_SYSTEM_SETTINGS',FALSE),
  ('partner','EDIT_TASK_DEFINITIONS',FALSE)
)
INSERT INTO role_permissions (role_id, permission_key, is_enabled)
SELECT r.id, p.pkey, p.enabled
FROM perms p
JOIN role_ids r ON r.code = p.role_code;

-- Index để query nhanh khi check permission trong API
CREATE INDEX idx_role_permissions_lookup ON role_permissions(role_id, permission_key, is_enabled);
