-- Calil — database schema
-- Run once on a fresh Supabase project (SQL editor or Management API).
-- Every row id is generated on the client (crypto.randomUUID) so writes can be
-- replayed idempotently from the offline queue with upsert.

create extension if not exists "pgcrypto";

-- ───────────────────────────── profiles ─────────────────────────────
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  name                 text,
  email                text,
  avatar_url           text,
  weight_unit          text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  rest_timer_enabled   boolean not null default true,
  default_rest_seconds integer not null default 90 check (default_rest_seconds between 0 and 900),
  dictation_lang       text not null default 'en-US',
  created_at           timestamptz not null default now()
);

-- Create a profile automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────── exercises ─────────────────────────────
-- user_id null = built-in exercise, visible to everyone, editable by no one.
create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  name         text not null,
  muscle_group text,
  equipment    text check (equipment in ('barbell','dumbbell','cable','machine','bodyweight','kettlebell','other')),
  aliases      text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists exercises_user_idx on public.exercises(user_id);

-- ───────────────────────────── plans ─────────────────────────────
create table if not exists public.workout_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists workout_templates_user_idx on public.workout_templates(user_id);

create table if not exists public.template_exercises (
  id                   uuid primary key default gen_random_uuid(),
  template_id          uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id          uuid not null references public.exercises(id) on delete cascade,
  position             integer not null default 0,
  target_sets          integer check (target_sets between 1 and 20),
  rep_min              integer check (rep_min between 0 and 200),
  rep_max              integer check (rep_max between 0 and 200),
  default_rest_seconds integer check (default_rest_seconds between 0 and 900),
  note                 text
);
create index if not exists template_exercises_template_idx on public.template_exercises(template_id);

-- ───────────────────────────── workouts ─────────────────────────────
create table if not exists public.workouts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  template_id      uuid references public.workout_templates(id) on delete set null,
  name             text not null default 'Workout',
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  duration_seconds integer,
  overall_note     text
);
create index if not exists workouts_user_started_idx on public.workouts(user_id, started_at desc);

create table if not exists public.workout_exercises (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position    integer not null default 0
);
create index if not exists workout_exercises_workout_idx on public.workout_exercises(workout_id);
create index if not exists workout_exercises_exercise_idx on public.workout_exercises(exercise_id);

create table if not exists public.sets (
  id                  uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number          integer not null default 1,
  weight              numeric(6,2),
  reps                integer,
  completed           boolean not null default false,
  note                text,
  completed_at        timestamptz
);
create index if not exists sets_workout_exercise_idx on public.sets(workout_exercise_id);

-- ───────────────────────────── personal names (also for built-ins)
create table if not exists public.exercise_aliases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  alias       text not null check (char_length(alias) between 1 and 60),
  created_at  timestamptz not null default now()
);
create index if not exists exercise_aliases_user_idx on public.exercise_aliases(user_id);

-- ───────────────────────────── row level security ─────────────────────────────
alter table public.profiles           enable row level security;
alter table public.exercises          enable row level security;
alter table public.workout_templates  enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workouts           enable row level security;
alter table public.workout_exercises  enable row level security;
alter table public.sets               enable row level security;

-- profiles: only yourself
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- exercises: read built-ins + own, write own only
drop policy if exists "read exercises" on public.exercises;
create policy "read exercises" on public.exercises
  for select using (user_id is null or user_id = auth.uid());
drop policy if exists "write own exercises" on public.exercises;
create policy "write own exercises" on public.exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- templates
drop policy if exists "own templates" on public.workout_templates;
create policy "own templates" on public.workout_templates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own template exercises" on public.template_exercises;
create policy "own template exercises" on public.template_exercises
  for all
  using (exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = auth.uid()))
  with check (
    exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid()))
  );

-- workouts
drop policy if exists "own workouts" on public.workouts;
create policy "own workouts" on public.workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own workout exercises" on public.workout_exercises;
create policy "own workout exercises" on public.workout_exercises
  for all
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid()))
  );

drop policy if exists "own sets" on public.sets;
create policy "own sets" on public.sets
  for all
  using (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = auth.uid()))
  with check (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = auth.uid()));

-- personal names
alter table public.exercise_aliases enable row level security;
drop policy if exists "own aliases" on public.exercise_aliases;
create policy "own aliases" on public.exercise_aliases
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid()))
  );

