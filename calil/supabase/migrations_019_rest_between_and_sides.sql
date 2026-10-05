-- Rest after the last set of an exercise (null = use the normal rest), and per-exercise
-- overrides for "weight per side" (true) vs "total weight" (false).
alter table public.profiles add column if not exists rest_between_exercises integer check (rest_between_exercises between 0 and 900);
alter table public.profiles add column if not exists per_side jsonb not null default '{}'::jsonb;
