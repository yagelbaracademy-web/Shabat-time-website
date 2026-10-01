-- 2026-10-02: warm-up sets (excluded from records, volume and progress)
alter table public.sets add column if not exists is_warmup boolean not null default false;
