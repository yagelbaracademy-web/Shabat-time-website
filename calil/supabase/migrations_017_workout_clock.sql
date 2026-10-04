-- The workout clock starts at the first ticked set and is kept even if that set is unticked.
-- paused_at / paused_seconds are for pausing the clock.
alter table public.workouts add column if not exists clock_started_at timestamptz;
alter table public.workouts add column if not exists paused_at timestamptz;
alter table public.workouts add column if not exists paused_seconds integer not null default 0 check (paused_seconds >= 0);
