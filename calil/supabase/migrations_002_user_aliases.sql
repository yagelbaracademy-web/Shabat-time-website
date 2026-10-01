-- 2026-10-01: personal exercise names that also work for built-in exercises
create table if not exists public.exercise_aliases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  alias       text not null check (char_length(alias) between 1 and 60),
  created_at  timestamptz not null default now()
);
create index if not exists exercise_aliases_user_idx on public.exercise_aliases(user_id);
alter table public.exercise_aliases enable row level security;
drop policy if exists "own aliases" on public.exercise_aliases;
create policy "own aliases" on public.exercise_aliases
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid()))
  );

-- T-Bar Row was missing from the built-in library
insert into public.exercises (id, user_id, name, muscle_group, equipment)
values ('d3891b06-a3b1-5a2f-a060-8c60f73409f2', null, 'T-Bar Row', 'Back', 'barbell')
on conflict (id) do nothing;
