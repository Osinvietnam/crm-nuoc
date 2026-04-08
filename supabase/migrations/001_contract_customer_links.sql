-- Lưu liên kết TB02 (Hợp đồng) ↔ TB01 (Khách hàng)
-- Chạy file này trong Supabase Dashboard > SQL Editor

create table if not exists contract_customer_links (
  contract_record_id  text primary key,
  customer_record_id  text not null,
  created_at          timestamptz default now()
);

-- Chỉ user đã đăng nhập mới truy cập
alter table contract_customer_links enable row level security;

create policy "authenticated_full_access" on contract_customer_links
  for all
  to authenticated
  using (true)
  with check (true);
