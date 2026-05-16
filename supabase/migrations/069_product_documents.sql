-- Migration 069: Thư viện tài liệu kỹ thuật (#5)

CREATE TABLE IF NOT EXISTS product_documents (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  loai        TEXT NOT NULL DEFAULT 'other', -- 'catalogue' | 'spec' | 'manual' | 'certificate' | 'other'
  ten_file    TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   BIGINT DEFAULT 0,     -- bytes
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_docs_product ON product_documents(product_id, created_at DESC);

ALTER TABLE product_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_docs_select" ON product_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_docs_insert" ON product_documents FOR INSERT TO authenticated WITH CHECK (
  get_my_role() IN ('admin', 'ceo', 'director')
);
CREATE POLICY "product_docs_delete" ON product_documents FOR DELETE TO authenticated USING (
  get_my_role() IN ('admin', 'ceo', 'director')
);
