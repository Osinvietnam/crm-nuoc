-- Migration 067: Lịch sử thay đổi giá sản phẩm (#3)

CREATE TABLE IF NOT EXISTS product_price_history (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  loai_gia    TEXT NOT NULL, -- 'niem_yet' | 'chiet_khau' | 'dai_ly' | 'npp' | 'hh_kd'
  gia_cu      NUMERIC,
  gia_moi     NUMERIC,
  changed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_product ON product_price_history(product_id, changed_at DESC);

ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_history_select" ON product_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_history_insert" ON product_price_history FOR INSERT TO authenticated WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'director')
);

-- Trigger: tự ghi history khi giá thay đổi
CREATE OR REPLACE FUNCTION log_product_price_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_uid UUID;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF OLD.gia_niem_yet   IS DISTINCT FROM NEW.gia_niem_yet   THEN
    INSERT INTO product_price_history(product_id, loai_gia, gia_cu, gia_moi, changed_by)
    VALUES(NEW.id, 'niem_yet',   OLD.gia_niem_yet,   NEW.gia_niem_yet,   v_uid);
  END IF;
  IF OLD.gia_chiet_khau IS DISTINCT FROM NEW.gia_chiet_khau THEN
    INSERT INTO product_price_history(product_id, loai_gia, gia_cu, gia_moi, changed_by)
    VALUES(NEW.id, 'chiet_khau', OLD.gia_chiet_khau, NEW.gia_chiet_khau, v_uid);
  END IF;
  IF OLD.gia_dai_ly     IS DISTINCT FROM NEW.gia_dai_ly     THEN
    INSERT INTO product_price_history(product_id, loai_gia, gia_cu, gia_moi, changed_by)
    VALUES(NEW.id, 'dai_ly',     OLD.gia_dai_ly,     NEW.gia_dai_ly,     v_uid);
  END IF;
  IF OLD.gia_npp        IS DISTINCT FROM NEW.gia_npp        THEN
    INSERT INTO product_price_history(product_id, loai_gia, gia_cu, gia_moi, changed_by)
    VALUES(NEW.id, 'npp',        OLD.gia_npp,        NEW.gia_npp,        v_uid);
  END IF;
  IF OLD.hh_kd          IS DISTINCT FROM NEW.hh_kd          THEN
    INSERT INTO product_price_history(product_id, loai_gia, gia_cu, gia_moi, changed_by)
    VALUES(NEW.id, 'hh_kd',      OLD.hh_kd,          NEW.hh_kd,          v_uid);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_price_history
  AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION log_product_price_change();
