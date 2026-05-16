-- Migration 084: User session tracking for activity analytics
-- Created: 2026-05-16

CREATE TABLE IF NOT EXISTS user_sessions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name    TEXT        NOT NULL DEFAULT '',
  role         TEXT        NOT NULL DEFAULT '',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  duration_min INTEGER GENERATED ALWAYS AS (
    GREATEST(0, FLOOR(
      EXTRACT(EPOCH FROM (COALESCE(ended_at, last_ping_at) - started_at)) / 60
    ))::INTEGER
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id   ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_ping ON user_sessions(last_ping_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started   ON user_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_open      ON user_sessions(user_id) WHERE ended_at IS NULL;

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Admin/ceo/director đọc tất cả — cần cho Realtime subscription + analytics API
CREATE POLICY "sessions_admin_read" ON user_sessions
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'ceo', 'director'));

-- Mỗi user đọc session của chính mình
CREATE POLICY "sessions_own_read" ON user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT/UPDATE qua service client (bypass RLS) — không cần write policy

COMMENT ON TABLE user_sessions IS 'Theo dõi phiên đăng nhập nhân viên — dùng heartbeat ping mỗi 5 phút';
COMMENT ON COLUMN user_sessions.duration_min IS 'Thời gian phiên (phút) — tự tính từ started_at đến ended_at hoặc last_ping_at';
