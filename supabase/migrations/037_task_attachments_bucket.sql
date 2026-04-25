-- ─── Migration 037: Tạo Storage bucket task-attachments ─────────────────────
-- Chạy trong Supabase SQL Editor

-- 1. Tạo bucket (public = true để link trực tiếp hoạt động)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  true,
  10485760,   -- 10 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS: Authenticated users có thể upload
CREATE POLICY "auth upload task attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

-- 3. RLS: Public read (link trực tiếp hoạt động)
CREATE POLICY "public read task attachments"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'task-attachments');

-- 4. RLS: Owner hoặc admin có thể xóa
CREATE POLICY "auth delete task attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (
      auth.uid() = owner
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'ceo', 'director')
    )
  );
