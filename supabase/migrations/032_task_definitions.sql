-- 032: task_definitions — catalog công việc WBS, Admin có thể chỉnh sửa qua UI
-- Thay thế lib/tasks/checklist.ts tĩnh bằng DB-driven, dynamic task catalog

-- ─── 1. Tạo bảng ─────────────────────────────────────────────────────────────

CREATE TABLE task_definitions (
  id                  BIGSERIAL PRIMARY KEY,
  stage_code          TEXT NOT NULL,    -- 'LM','TN','BG','DN','CH','GH','NT','BH','BT','HST'
  stage_label         TEXT NOT NULL,    -- 'Lead mới', 'Tiềm năng', ... (hiển thị UI)
  task_key            TEXT NOT NULL UNIQUE, -- WBS code: LM-KD-01
  label               TEXT NOT NULL,    -- Tên task hiển thị (Admin chỉnh được)
  bo_phan             TEXT NOT NULL,    -- 'KD','KT','KTO','BLD','HC'
  task_type           TEXT NOT NULL DEFAULT 'mandatory'
                      CHECK (task_type IN ('mandatory','optional','conditional')),
  requires_attachment BOOLEAN NOT NULL DEFAULT FALSE,
  order_types         TEXT[] NOT NULL DEFAULT ARRAY['B2C','Thuong_mai','Du_an'],
  roles_can_update    TEXT[] NOT NULL,  -- ai được chuyển trạng thái
  roles_can_approve   TEXT[] NOT NULL,  -- ai được tick 'Hoàn thành'
  sort_order          INT NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_def_stage_code ON task_definitions(stage_code);
CREATE INDEX idx_task_def_bo_phan    ON task_definitions(bo_phan);
CREATE INDEX idx_task_def_active     ON task_definitions(stage_code, sort_order) WHERE is_active = TRUE;

ALTER TABLE task_definitions ENABLE ROW LEVEL SECURITY;
-- Đọc: tất cả authenticated
CREATE POLICY "task_def_select" ON task_definitions FOR SELECT TO authenticated USING (true);
-- Ghi: chỉ admin (qua service role API)
CREATE POLICY "task_def_admin_write" ON task_definitions
  FOR ALL USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

COMMENT ON TABLE task_definitions IS 'Catalog công việc WBS theo stage pipeline — nguồn chân lý cho checklist';
COMMENT ON COLUMN task_definitions.task_key  IS 'WBS code duy nhất: [STAGE]-[DEPT]-[SEQ], e.g. LM-KD-01';
COMMENT ON COLUMN task_definitions.task_type IS 'mandatory=bắt buộc | optional=khuyến khích | conditional=theo điều kiện hệ thống';

-- ─── 2. Trigger updated_at ────────────────────────────────────────────────────
CREATE TRIGGER task_definitions_updated_at
  BEFORE UPDATE ON task_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. Seed dữ liệu — 51 tasks WBS ──────────────────────────────────────────

INSERT INTO task_definitions
  (stage_code, stage_label, task_key, label, bo_phan, task_type,
   requires_attachment, order_types, roles_can_update, roles_can_approve, sort_order)
VALUES

-- ════════════════════════════════════════════════════════════════════
-- STAGE: LM — Lead mới (4 tasks)
-- ════════════════════════════════════════════════════════════════════
('LM','Lead mới','LM-KD-01',
 'Nhập đầy đủ thông tin KH vào CRM',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 10),

('LM','Lead mới','LM-KD-02',
 'Ghi rõ nguồn KH (Facebook / Zalo / Referral / Hội chợ...)',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 20),

('LM','Lead mới','LM-KD-03',
 'Gọi điện xác nhận nhu cầu + ghi nội dung trao đổi vào CRM',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 30),

('LM','Lead mới','LM-KD-04',
 'Phân loại tiềm năng A/B/C + ghi loại nhà, nguồn nước',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 40),

-- ════════════════════════════════════════════════════════════════════
-- STAGE: TN — Tiềm năng (5 tasks)
-- ════════════════════════════════════════════════════════════════════
('TN','Tiềm năng','TN-KD-01',
 'Đặt lịch hẹn khảo sát + phân công KTV phụ trách',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 10),

('TN','Tiềm năng','TN-KT-01',
 'Thực hiện khảo sát hiện trường tại KH',
 'KT','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 20),

('TN','Tiềm năng','TN-KT-02',
 'Điền kết quả khảo sát vào CRM (công suất, nguồn nước, diện tích)',
 'KT','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 30),

('TN','Tiềm năng','TN-KD-02',
 'Ghi kế hoạch tiếp cận (nhu cầu · rào cản · bước tiếp theo)',
 'KD','optional',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 40),

('TN','Tiềm năng','TN-KD-03',
 'Cập nhật mức ưu tiên và sản phẩm quan tâm',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 50),

-- ════════════════════════════════════════════════════════════════════
-- STAGE: BG — Báo giá (6 tasks)
-- ════════════════════════════════════════════════════════════════════
('BG','Báo giá','BG-KT-01',
 'Lên phương án kỹ thuật (model SP, công suất, danh mục vật tư)',
 'KT','mandatory',FALSE,
 ARRAY['Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 10),

('BG','Báo giá','BG-KD-01',
 'Soạn báo giá 2–3 phương án trong CRM',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 20),

('BG','Báo giá','BG-KT-02',
 'KTV review thông số kỹ thuật + kiểm tra đủ vật tư phụ',
 'KT','mandatory',FALSE,
 ARRAY['Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 30),

('BG','Báo giá','BG-BLD-01',
 'Phó GĐ / CEO duyệt báo giá (áp dụng khi ≥ ngưỡng hệ thống)',
 'BLD','conditional',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['director','ceo','admin'],
 ARRAY['ceo','admin'], 40),

('BG','Báo giá','BG-KD-02',
 'Gửi báo giá cho KH (email / Zalo) + ghi ngày gửi',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 50),

('BG','Báo giá','BG-KD-03',
 'Ghi nhận phản hồi của KH sau khi nhận báo giá',
 'KD','optional',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 60),

-- ════════════════════════════════════════════════════════════════════
-- STAGE: DN — Đàm phán (4 tasks) — chỉ Thương mại + Dự án
-- ════════════════════════════════════════════════════════════════════
('DN','Đàm phán','DN-KD-01',
 'Trình bày / Tư vấn chọn phương án phù hợp với KH',
 'KD','mandatory',FALSE,
 ARRAY['Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 10),

('DN','Đàm phán','DN-KD-02',
 'Xử lý phản đối — ghi nhận lo ngại và cách giải quyết',
 'KD','mandatory',FALSE,
 ARRAY['Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 20),

('DN','Đàm phán','DN-KD-03',
 'Xin duyệt chiết khấu (áp dụng khi vượt ngưỡng tự quyết)',
 'KD','conditional',FALSE,
 ARRAY['Thuong_mai','Du_an'],
 ARRAY['sales','director','ceo','admin'],
 ARRAY['director','ceo','admin'], 30),

('DN','Đàm phán','DN-KD-04',
 'Ghi nhận đối thủ cạnh tranh KH đang cân nhắc',
 'KD','optional',FALSE,
 ARRAY['Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 40),

-- ════════════════════════════════════════════════════════════════════
-- STAGE: HST — Hồ sơ thầu (4 tasks) — chỉ Dự án
-- (vị trí: sau Đàm phán, trước Chốt HĐ)
-- ════════════════════════════════════════════════════════════════════
('HST','Hồ sơ thầu','HST-KD-01',
 'Chuẩn bị hồ sơ năng lực công ty + giấy tờ pháp nhân',
 'KD','mandatory',TRUE,
 ARRAY['Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','ceo','admin'], 10),

('HST','Hồ sơ thầu','HST-KD-02',
 'Soạn đề xuất kỹ thuật + hồ sơ dự thầu',
 'KD','mandatory',TRUE,
 ARRAY['Du_an'],
 ARRAY['sales','director','admin','ceo'],
 ARRAY['director','ceo','admin'], 20),

('HST','Hồ sơ thầu','HST-BLD-01',
 'Ban lãnh đạo duyệt hồ sơ thầu trước khi nộp',
 'BLD','mandatory',FALSE,
 ARRAY['Du_an'],
 ARRAY['director','ceo','admin'],
 ARRAY['ceo','admin'], 30),

('HST','Hồ sơ thầu','HST-KD-03',
 'Nộp hồ sơ + ghi nhận ngày mở thầu / kết quả',
 'KD','mandatory',FALSE,
 ARRAY['Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','ceo','admin'], 40),

-- ════════════════════════════════════════════════════════════════════
-- STAGE: CH — Chốt HĐ (7 tasks)
-- ════════════════════════════════════════════════════════════════════
('CH','Chốt HĐ','CH-KD-01',
 'Soạn hợp đồng từ template trong CRM',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 10),

('CH','Chốt HĐ','CH-KTO-01',
 'Kế toán review điều khoản thanh toán trong HĐ',
 'KTO','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['accountant','admin','ceo'],
 ARRAY['director','admin','ceo'], 20),

('CH','Chốt HĐ','CH-BLD-01',
 'Phó GĐ duyệt và ký HĐ',
 'BLD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['director','admin'],
 ARRAY['ceo','admin'], 30),

('CH','Chốt HĐ','CH-BLD-02',
 'CEO duyệt và ký HĐ (áp dụng khi ≥ ngưỡng CEO)',
 'BLD','conditional',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['ceo','admin'],
 ARRAY['ceo','admin'], 40),

('CH','Chốt HĐ','CH-KTO-02',
 'Thu 60% thanh toán đợt 1',
 'KTO','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','accountant','admin','ceo'],
 ARRAY['accountant','director','admin','ceo'], 50),

('CH','Chốt HĐ','CH-KT-01',
 'Khảo sát lắp đặt + lên bản vẽ thiết kế',
 'KT','mandatory',TRUE,
 ARRAY['Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 60),

('CH','Chốt HĐ','CH-KD-02',
 'Chuẩn bị giấy phép thi công / giấy tờ pháp lý',
 'KD','mandatory',FALSE,
 ARRAY['Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 70),

-- ════════════════════════════════════════════════════════════════════
-- STAGE: GH — Giao hàng (8 tasks)
-- ════════════════════════════════════════════════════════════════════
('GH','Giao hàng','GH-KTO-01',
 'Xác nhận đã thu đủ 60% — phê duyệt xuất kho',
 'KTO','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['accountant','admin','ceo'],
 ARRAY['director','admin','ceo'], 10),

('GH','Giao hàng','GH-HC-01',
 'Kiểm kho + chuẩn bị hàng đúng theo đơn',
 'HC','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['logistics','admin','ceo'],
 ARRAY['director','admin','ceo'], 20),

('GH','Giao hàng','GH-KT-01',
 'KTV ký nhận hàng xuất kho',
 'KT','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 30),

('GH','Giao hàng','GH-KT-02',
 'Giao hàng đến công trình / địa chỉ KH',
 'KT','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','logistics','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 40),

('GH','Giao hàng','GH-KT-03',
 'Thi công lắp đặt và cài đặt thiết bị',
 'KT','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 50),

('GH','Giao hàng','GH-KT-04',
 'Vệ sinh công trình + chụp ảnh hoàn công (bắt buộc)',
 'KT','mandatory',TRUE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 60),

('GH','Giao hàng','GH-KT-05',
 'Quay video thi công / demo sản phẩm (khuyến khích)',
 'KT','optional',TRUE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 70),

('GH','Giao hàng','GH-KTO-02',
 'Thu 35% thanh toán đợt 2',
 'KTO','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','accountant','admin','ceo'],
 ARRAY['accountant','director','admin','ceo'], 80),

-- ════════════════════════════════════════════════════════════════════
-- STAGE: NT — Nghiệm thu (5 tasks)
-- ════════════════════════════════════════════════════════════════════
('NT','Nghiệm thu','NT-KT-01',
 'Vận hành thiết bị + kiểm tra chất lượng nước cùng KH',
 'KT','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 10),

('NT','Nghiệm thu','NT-KD-01',
 'Ký biên bản nghiệm thu 3 bên (KH + Sale + KTV)',
 'KD','mandatory',TRUE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 20),

('NT','Nghiệm thu','NT-KT-02',
 'Quay video hướng dẫn sử dụng + bàn giao vận hành',
 'KT','optional',TRUE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 30),

('NT','Nghiệm thu','NT-KTO-01',
 'Thu 5% thanh toán đợt 3 — tất toán hợp đồng',
 'KTO','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','accountant','admin','ceo'],
 ARRAY['accountant','director','admin','ceo'], 40),

('NT','Nghiệm thu','NT-KD-02',
 'Xin giới thiệu KH mới + ghi nhận mức độ hài lòng',
 'KD','optional',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 50),

-- ════════════════════════════════════════════════════════════════════
-- STAGE: BH — Bảo hành (4 tasks) — dùng warranty_tickets (bảng riêng)
-- Các task này là template cho warranty_tasks, không dùng task_completions
-- ════════════════════════════════════════════════════════════════════
('BH','Bảo hành','BH-KD-01',
 'Tiếp nhận yêu cầu bảo hành + tạo ticket + phân công KTV',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 10),

('BH','Bảo hành','BH-KT-01',
 'Xác định nguyên nhân lỗi + mức độ (Nhẹ / TB / Nghiêm trọng)',
 'KT','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 20),

('BH','Bảo hành','BH-KT-02',
 'Sửa chữa / thay thế linh kiện trong hạn bảo hành',
 'KT','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 30),

('BH','Bảo hành','BH-KT-03',
 'Ghi nhận kết quả xử lý + chụp ảnh trước/sau',
 'KT','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 40),

-- ════════════════════════════════════════════════════════════════════
-- STAGE: BT — Bảo trì (4 tasks) — dùng warranty_tickets (bảng riêng)
-- ════════════════════════════════════════════════════════════════════
('BT','Bảo trì','BT-KD-01',
 'Liên hệ KH đặt lịch bảo trì định kỳ',
 'KD','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['sales','admin','ceo'],
 ARRAY['director','admin','ceo'], 10),

('BT','Bảo trì','BT-KT-01',
 'Thực hiện bảo trì theo checklist kỹ thuật tiêu chuẩn',
 'KT','mandatory',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 20),

('BT','Bảo trì','BT-KT-02',
 'Báo cáo tình trạng thiết bị + chụp ảnh hiện trạng',
 'KT','mandatory',TRUE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 30),

('BT','Bảo trì','BT-KD-02',
 'Đề xuất nâng cấp thiết bị nếu có dấu hiệu xuống cấp',
 'KD','optional',FALSE,
 ARRAY['B2C','Thuong_mai','Du_an'],
 ARRAY['tech','sales','director','admin','ceo'],
 ARRAY['director','admin','ceo'], 40);

-- Tổng: 51 tasks (4+5+6+4+4+7+8+5+4+4)
