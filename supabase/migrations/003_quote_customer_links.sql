create table if not exists quote_customer_links (
  quote_record_id    text primary key,
  customer_record_id text not null,
  version            int  not null default 1,
  created_at         timestamptz default now()
);

create index if not exists quote_customer_links_customer_idx
  on quote_customer_links (customer_record_id);

alter table quote_customer_links enable row level security;

create policy "authenticated_full_access" on quote_customer_links
  for all to authenticated using (true) with check (true);
