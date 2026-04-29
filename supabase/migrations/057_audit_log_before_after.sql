-- Migration 057: Add before_data / after_data JSONB columns to audit_logs
-- Allows structured before/after diffs for high-value audit events

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS before_data JSONB,
  ADD COLUMN IF NOT EXISTS after_data  JSONB;
