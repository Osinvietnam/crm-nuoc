-- Migration 061: Customer Activity Timeline
-- Chạy trong Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS customer_activities (
  id          bigserial PRIMARY KEY,
  customer_id bigint      NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id),
  user_name   text        NOT NULL,
  type        text        NOT NULL, -- 'call' | 'note' | 'pipeline_change' | 'quote_created' | 'order_created' | 'payment' | 'maintenance' | 'warranty' | 'contact_log'
  content     text,
  meta        jsonb,                -- { from, to, amount, result, etc. }
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_activities_customer
  ON customer_activities(customer_id, created_at DESC);

-- RLS
ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;

-- Tất cả authenticated users đọc được activities của KH họ có quyền xem
CREATE POLICY "activities_select" ON customer_activities
  FOR SELECT TO authenticated
  USING (true);

-- Chỉ system (service role) hoặc user chính chủ mới insert
CREATE POLICY "activities_insert" ON customer_activities
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
