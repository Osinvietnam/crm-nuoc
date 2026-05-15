-- Migration 075: Trigger đồng bộ trang_thai_nv ↔ is_active trên profiles
-- Đảm bảo khi update trực tiếp qua DB (ngoài API), hai field vẫn nhất quán

CREATE OR REPLACE FUNCTION sync_nv_active_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Nghỉ việc → tắt is_active
  IF NEW.trang_thai_nv = 'Nghỉ việc' AND (OLD.trang_thai_nv IS DISTINCT FROM 'Nghỉ việc') THEN
    NEW.is_active := false;
  END IF;

  -- Quay lại trạng thái đang làm từ Nghỉ việc → bật is_active
  IF OLD.trang_thai_nv = 'Nghỉ việc'
     AND NEW.trang_thai_nv IN ('Đang làm', 'Thử việc', 'Tạm nghỉ') THEN
    NEW.is_active := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nv_active ON profiles;
CREATE TRIGGER trg_sync_nv_active
  BEFORE UPDATE OF trang_thai_nv ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_nv_active_status();

COMMENT ON FUNCTION sync_nv_active_status() IS
  'Đồng bộ is_active theo trang_thai_nv: Nghỉ việc → false, các trạng thái khác từ Nghỉ việc → true';
