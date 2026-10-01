-- 2026-10-01: show built-in exercise names in Hebrew (display only)
alter table public.profiles add column if not exists exercise_names text not null default 'en' check (exercise_names in ('en','he'));
