-- 2026-10-01: user-defined order of plans (drag to reorder). Null = by creation date.
alter table public.workout_templates add column if not exists position integer;
