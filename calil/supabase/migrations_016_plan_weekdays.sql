-- Optional training days for a plan (0 = Sunday … 6 = Saturday). Empty = no fixed days (rotation).
alter table public.workout_templates add column if not exists weekdays smallint[] not null default '{}';
