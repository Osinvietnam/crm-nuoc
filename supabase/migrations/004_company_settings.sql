-- Bảng lưu thông tin công ty (single-row, id luôn = 1)
create table if not exists company_settings (
  id         int primary key default 1,
  name       text not null default '',
  address    text          default '',
  phone      text          default '',
  email      text          default '',
  tax        text          default '',
  website    text          default '',
  updated_at timestamptz   default now(),
  constraint single_row check (id = 1)
);

-- Seed row mặc định
insert into company_settings (id) values (1)
on conflict (id) do nothing;

-- RLS: authenticated đọc được, write chỉ qua API route (đã kiểm tra role)
alter table company_settings enable row level security;

create policy "authenticated_read_company"
  on company_settings for select
  to authenticated
  using (true);

create policy "authenticated_write_company"
  on company_settings for update
  to authenticated
  using (true)
  with check (true);
