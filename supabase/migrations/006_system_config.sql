create table if not exists system_config (
  key        text primary key,
  value      text        not null default '',
  updated_at timestamptz not null default now()
);

-- Seed các key mặc định
insert into system_config (key, value) values
  ('n8n_webhook_url', ''),
  ('app_url',         '')
on conflict (key) do nothing;

alter table system_config enable row level security;

create policy "authenticated_read_config"
  on system_config for select
  to authenticated
  using (true);

create policy "authenticated_write_config"
  on system_config for all
  to authenticated
  using (true)
  with check (true);
