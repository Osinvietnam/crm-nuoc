-- Lưu liên kết TB02 (Hợp đồng) ↔ TB07 (Công trình) ↔ TB01 (Khách hàng)
-- Dùng để auto-create TB07 khi HĐ → "Đang thi công" (Q4)
-- và auto-create TB11 khi CT → "Đã nghiệm thu" (Q5)

create table if not exists construction_contract_links (
  contract_record_id      text primary key,
  construction_record_id  text not null,
  customer_record_id      text,
  periodic_service_created boolean not null default false,
  created_at              timestamptz default now()
);

create unique index if not exists construction_contract_links_construction_idx
  on construction_contract_links (construction_record_id);

alter table construction_contract_links enable row level security;

create policy "authenticated_full_access" on construction_contract_links
  for all
  to authenticated
  using (true)
  with check (true);
