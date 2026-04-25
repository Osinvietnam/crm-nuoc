-- 035: warranty_tickets + warranty_tasks — bảo hành / bảo trì lặp lại nhiều lần
--      Tách riêng khỏi task_completions vì mỗi đơn có thể có nhiều lần BH/BT

-- ─── 1. warranty_tickets — mỗi lần bảo hành / bảo trì = 1 ticket ─────────────

CREATE TABLE warranty_tickets (
  id              BIGSERIAL PRIMARY KEY,
  order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_type     TEXT   NOT NULL CHECK (ticket_type IN ('bao_hanh','bao_tri')),
  sequence_no     INT    NOT NULL DEFAULT 1,  -- lần 1, 2, 3...
  title           TEXT,                        -- "Bảo hành lần 1 — máy lọc tầng hầm"
  severity        TEXT   CHECK (severity IN ('nhe','trung_binh','nghiem_trong')),
                                               -- chỉ dùng cho bao_hanh
  status          TEXT   NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','in_progress','resolved','closed')),
  description     TEXT,                        -- Mô tả lỗi / nội dung cần bảo trì
  scheduled_date  DATE,                        -- Ngày dự kiến thực hiện
  completed_date  DATE,                        -- Ngày hoàn thành thực tế
  assigned_tech   UUID   REFERENCES profiles(id) ON DELETE SET NULL,
  created_by      UUID   NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, ticket_type, sequence_no)
);

CREATE INDEX idx_warranty_tickets_order    ON warranty_tickets(order_id);
CREATE INDEX idx_warranty_tickets_type     ON warranty_tickets(ticket_type, status);
CREATE INDEX idx_warranty_tickets_tech     ON warranty_tickets(assigned_tech);
CREATE INDEX idx_warranty_tickets_date     ON warranty_tickets(scheduled_date);

ALTER TABLE warranty_tickets ENABLE ROW LEVEL SECURITY;

-- Sales thấy ticket của KH mình; tech thấy ticket được assign; admin/ceo/director thấy tất cả
CREATE POLICY "warranty_tickets_select" ON warranty_tickets FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('admin','ceo','director','accountant')
    OR created_by = auth.uid()
    OR assigned_tech = auth.uid()
    OR EXISTS (
      SELECT 1 FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.id = warranty_tickets.order_id
        AND c.nguoi_phu_trach = auth.uid()
    )
  );

CREATE POLICY "warranty_tickets_insert" ON warranty_tickets FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin','ceo','director','sales')
  );

CREATE POLICY "warranty_tickets_update" ON warranty_tickets FOR UPDATE TO authenticated
  USING (
    get_my_role() IN ('admin','ceo','director')
    OR assigned_tech = auth.uid()
    OR created_by = auth.uid()
  );

COMMENT ON TABLE warranty_tickets IS 'Ticket bảo hành / bảo trì — tách riêng vì 1 đơn có nhiều lần BH/BT';
COMMENT ON COLUMN warranty_tickets.severity IS 'Mức độ nghiêm trọng BH: nhe|trung_binh|nghiem_trong — trigger notify Sales+Director nếu nghiem_trong';

-- ─── 2. warranty_tasks — task checklist trong mỗi ticket ─────────────────────

CREATE TABLE warranty_tasks (
  id              BIGSERIAL PRIMARY KEY,
  ticket_id       BIGINT NOT NULL REFERENCES warranty_tickets(id) ON DELETE CASCADE,
  task_key        TEXT   NOT NULL,  -- WBS code: BH-KD-01, BT-KT-01...
  status          TEXT   NOT NULL DEFAULT 'dang_lam'
                         CHECK (status IN ('dang_lam','kiem_tra','hoan_thanh','blocked')),
  blocked_reason      TEXT,
  blocked_waiting_for TEXT,
  attachment_url      TEXT,
  notes               TEXT,
  updated_by          UUID   REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_name     TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, task_key)
);

CREATE INDEX idx_warranty_tasks_ticket ON warranty_tasks(ticket_id, status);

ALTER TABLE warranty_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warranty_tasks_all" ON warranty_tasks FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warranty_tickets wt
      WHERE wt.id = warranty_tasks.ticket_id
        AND (
          get_my_role() IN ('admin','ceo','director')
          OR wt.assigned_tech = auth.uid()
          OR wt.created_by = auth.uid()
        )
    )
  );

COMMENT ON TABLE warranty_tasks IS 'Tasks trong mỗi warranty ticket — dùng cùng WBS keys với task_definitions';

-- ─── 3. Trigger updated_at ────────────────────────────────────────────────────

CREATE TRIGGER warranty_tickets_updated_at
  BEFORE UPDATE ON warranty_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
