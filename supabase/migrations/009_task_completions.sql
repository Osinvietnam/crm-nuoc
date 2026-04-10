-- 009: Task checklist — lưu trạng thái hoàn thành công việc theo stage/KH

CREATE TABLE task_completions (
  id                 BIGSERIAL PRIMARY KEY,
  customer_record_id TEXT NOT NULL,          -- LarkBase customer record_id
  stage              TEXT NOT NULL,           -- pipeline stage (e.g. 'Lead mới')
  task_key           TEXT NOT NULL,           -- unique task identifier (e.g. 'lead_01')
  completed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by_name  TEXT,
  completed_at       TIMESTAMPTZ DEFAULT NOW(),
  notes              TEXT,
  UNIQUE(customer_record_id, stage, task_key)
);

CREATE INDEX ON task_completions(customer_record_id, stage);
CREATE INDEX ON task_completions(completed_by);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage task completions"
  ON task_completions FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE task_completions IS 'Checklist công việc theo stage pipeline — ai tick, lúc nào';
