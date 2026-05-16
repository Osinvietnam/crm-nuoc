-- Migration 066: Fix products RLS DELETE + unique constraint on ma_sp

-- Fix A2: RLS DELETE cho phép admin/ceo/director (khớp với app layer)
DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE USING (
  get_my_role() IN ('admin', 'ceo', 'director')
);

-- Fix B1: UNIQUE constraint trên ma_sp (nullable — cho phép nhiều NULL)
ALTER TABLE products
  ADD CONSTRAINT products_ma_sp_unique UNIQUE (ma_sp);
