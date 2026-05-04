-- Migration 058: Thêm director vào RLS INSERT + UPDATE của products
-- Trước đây chỉ admin/ceo, nhưng app route PATCH đã cho director từ đầu → mismatch

DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;

CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'director')
);

CREATE POLICY "products_update" ON products FOR UPDATE USING (
  get_my_role() IN ('admin', 'ceo', 'director')
);
