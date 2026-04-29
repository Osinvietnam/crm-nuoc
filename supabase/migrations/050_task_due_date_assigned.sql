-- Migration 050: thêm due_date và assigned_to vào task_completions (TASK-15, TASK-16)

ALTER TABLE task_completions
  ADD COLUMN IF NOT EXISTS due_date        DATE,
  ADD COLUMN IF NOT EXISTS assigned_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
