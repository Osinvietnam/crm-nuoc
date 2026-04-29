-- 047: Siết RLS task_completions — chỉ role trong roles_can_update mới INSERT/UPDATE được

-- Xóa policy cũ quá rộng (mọi authenticated user đều manage được)
DROP POLICY IF EXISTS "authenticated users can manage task completions" ON task_completions;

-- ─── SELECT: mọi user xác thực đọc được ─────────────────────────────────────
CREATE POLICY "task_completions_select"
  ON task_completions FOR SELECT TO authenticated
  USING (true);

-- ─── INSERT: admin/ceo/director bypass; role khác phải nằm trong roles_can_update ──
CREATE POLICY "task_completions_insert"
  ON task_completions FOR INSERT TO authenticated
  WITH CHECK (
    -- Bypass: admin / ceo / director
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'director')
    )
    OR
    -- Role nằm trong roles_can_update của task definition tương ứng
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN task_definitions td ON td.task_key = task_key
      WHERE p.id = auth.uid()
        AND td.roles_can_update @> ARRAY[p.role]
    )
  );

-- ─── UPDATE: cùng điều kiện INSERT ───────────────────────────────────────────
CREATE POLICY "task_completions_update"
  ON task_completions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'director')
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN task_definitions td ON td.task_key = task_completions.task_key
      WHERE p.id = auth.uid()
        AND td.roles_can_update @> ARRAY[p.role]
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'director')
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN task_definitions td ON td.task_key = task_key
      WHERE p.id = auth.uid()
        AND td.roles_can_update @> ARRAY[p.role]
    )
  );

-- ─── DELETE: chỉ admin / ceo / director ──────────────────────────────────────
CREATE POLICY "task_completions_delete"
  ON task_completions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'director')
    )
  );
