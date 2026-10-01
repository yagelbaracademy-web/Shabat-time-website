-- 2026-10-01: how to address the user in Hebrew (neutral plural, masculine, feminine)
alter table public.profiles add column if not exists address text not null default 'neutral' check (address in ('neutral','m','f'));
