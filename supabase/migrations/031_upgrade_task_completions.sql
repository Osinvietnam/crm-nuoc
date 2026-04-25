-- 031: Nâng cấp task_completions — thêm multi-status, order_id FK, blocked support
-- Backward compat: giữ customer_record_id + task_key cũ, thêm cột mới bên cạnh

-- ─── 1. Thêm order_id FK ────────────────────────────────────────────────────
ALTER TABLE task_completions
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_task_completions_order_id
  ON task_completions(order_id, stage);

-- ─── 2. Thêm status (4 giá trị — không lưu 'chua_lam', record vắng = chưa làm)
ALTER TABLE task_completions
  ADD COLUMN IF NOT EXISTS status TEXT;

-- Existing records = đã hoàn thành (binary design cũ) → migrate sang 'hoan_thanh'
UPDATE task_completions
  SET status = 'hoan_thanh'
  WHERE status IS NULL;

ALTER TABLE task_completions
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'dang_lam',
  ADD CONSTRAINT task_completions_status_check
    CHECK (status IN ('dang_lam', 'kiem_tra', 'hoan_thanh', 'blocked'));

-- ─── 3. Thêm blocked support ────────────────────────────────────────────────
ALTER TABLE task_completions
  ADD COLUMN IF NOT EXISTS blocked_reason      TEXT,
  ADD COLUMN IF NOT EXISTS blocked_waiting_for TEXT;

-- ─── 4. Thêm attachment support (cho 3 task cần file) ───────────────────────
ALTER TABLE task_completions
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- ─── 5. Thêm updated_by / updated_at (thay thế completed_by / completed_at)
--        Giữ cột cũ để không phá code hiện tại
ALTER TABLE task_completions
  ADD COLUMN IF NOT EXISTS updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_name   TEXT,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

-- Backfill updated_by từ completed_by (nếu có data cũ)
UPDATE task_completions
  SET updated_by      = completed_by,
      updated_by_name = completed_by_name,
      updated_at      = completed_at
  WHERE updated_by IS NULL AND completed_by IS NOT NULL;

-- ─── 6. Index bổ sung ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_task_completions_status
  ON task_completions(status);

COMMENT ON COLUMN task_completions.status            IS 'dang_lam|kiem_tra|hoan_thanh|blocked — không có record = chua_lam';
COMMENT ON COLUMN task_completions.order_id          IS 'FK → orders.id (checklist theo đơn hàng — design mới)';
COMMENT ON COLUMN task_completions.blocked_reason    IS 'Lý do task bị blocked (bắt buộc khi status=blocked)';
COMMENT ON COLUMN task_completions.blocked_waiting_for IS 'Đang chờ ai/gì để unblock';
COMMENT ON COLUMN task_completions.attachment_url    IS 'URL file đính kèm task (bản vẽ / ảnh hoàn công / biên bản)';
