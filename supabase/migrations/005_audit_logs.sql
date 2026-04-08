create table if not exists audit_logs (
  id         bigserial primary key,
  user_id    uuid        not null references auth.users(id) on delete set null,
  user_name  text        not null default '',
  action     text        not null,   -- 'role_changed' | 'user_deactivated' | 'settings_updated' | ...
  entity     text        not null,   -- 'user' | 'company_settings' | 'quote'
  detail     text        not null default '',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);

alter table audit_logs enable row level security;

-- Admin + manager đọc được, insert qua API (server-side, bypass RLS với service role)
create policy "authenticated_read_audit"
  on audit_logs for select
  to authenticated
  using (true);

create policy "authenticated_insert_audit"
  on audit_logs for insert
  to authenticated
  with check (true);
