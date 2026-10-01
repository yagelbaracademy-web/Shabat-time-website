-- 2026-10-02: per-exercise rest time chosen by the user ({exercise_id: seconds}, 0 = no timer)
alter table public.profiles add column if not exists rest_by_exercise jsonb not null default '{}'::jsonb;
