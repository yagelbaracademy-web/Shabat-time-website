-- 2026-10-01: interface language
alter table public.profiles add column if not exists language text not null default 'en' check (language in ('en','he'));
