-- 043: Thêm thông tin ngân hàng vào company_settings (DOC-01)
alter table company_settings
  add column if not exists bank_name       text not null default '',
  add column if not exists account_number  text not null default '',
  add column if not exists account_holder  text not null default '';
