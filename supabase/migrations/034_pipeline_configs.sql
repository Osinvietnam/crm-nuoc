-- 034: pipeline_configs — cấu hình stage pipeline theo loại đơn hàng
--      Admin chỉnh được thứ tự và bật/tắt stage qua UI

CREATE TABLE pipeline_configs (
  order_type   TEXT    NOT NULL PRIMARY KEY, -- 'B2C','Thuong_mai','Du_an'
  display_name TEXT    NOT NULL,
  description  TEXT,
  stages       TEXT[]  NOT NULL,  -- stage_code theo thứ tự: ['LM','TN','BG',...]
  stage_labels TEXT[]  NOT NULL,  -- label tương ứng: ['Lead mới','Tiềm năng',...]
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pipeline_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_config_select" ON pipeline_configs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pipeline_config_admin_write" ON pipeline_configs
  FOR ALL USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

COMMENT ON TABLE pipeline_configs IS 'Cấu hình pipeline stage theo loại đơn hàng — Admin quản lý';
COMMENT ON COLUMN pipeline_configs.stages IS 'Stage codes theo thứ tự, e.g. ARRAY[''LM'',''TN'',''BG'']';

-- ─── Seed: 3 pipeline presets ─────────────────────────────────────────────────

INSERT INTO pipeline_configs (order_type, display_name, description, stages, stage_labels) VALUES

('B2C',
 'B2C — Cá nhân / Hộ gia đình',
 'Pipeline 7 stage cho đơn hàng cá nhân, quyết định nhanh, bỏ qua Đàm phán',
 ARRAY['LM','TN','BG','CH','GH','NT','BH','BT'],
 ARRAY['Lead mới','Tiềm năng','Báo giá','Chốt HĐ','Giao hàng','Nghiệm thu','Bảo hành','Bảo trì']),

('Thuong_mai',
 'Thương mại — Doanh nghiệp / Tòa nhà',
 'Pipeline 9 stage đầy đủ cho đơn hàng thương mại, có Đàm phán',
 ARRAY['LM','TN','BG','DN','CH','GH','NT','BH','BT'],
 ARRAY['Lead mới','Tiềm năng','Báo giá','Đàm phán','Chốt HĐ','Giao hàng','Nghiệm thu','Bảo hành','Bảo trì']),

('Du_an',
 'Dự án — Công trình lớn / Đấu thầu',
 'Pipeline 10 stage, có Hồ sơ thầu sau Đàm phán (đầu việc placeholder)',
 ARRAY['LM','TN','BG','DN','HST','CH','GH','NT','BH','BT'],
 ARRAY['Lead mới','Tiềm năng','Báo giá','Đàm phán','Hồ sơ thầu','Chốt HĐ','Giao hàng','Nghiệm thu','Bảo hành','Bảo trì']);

-- ─── Thêm cột order_type vào bảng orders (nếu chưa có) ───────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'B2C'
  CHECK (order_type IN ('B2C','Thuong_mai','Du_an'));

COMMENT ON COLUMN orders.order_type IS 'Loại đơn: B2C | Thuong_mai | Du_an — quyết định pipeline stages và task checklist';
