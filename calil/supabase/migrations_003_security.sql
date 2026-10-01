-- 2026-10-01: AI usage limits, consent record

-- Daily AI usage per user. Written only through ai_take(); users can read their own rows.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  kind    text not null check (kind in ('dictate', 'import')),
  count   integer not null default 0,
  primary key (user_id, day, kind)
);
alter table public.ai_usage enable row level security;
drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage for select using (user_id = auth.uid());

-- Counts one AI call for the signed-in user and says whether it is within today's limit.
create or replace function public.ai_take(p_kind text, p_limit integer)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare n integer;
begin
  if auth.uid() is null then return false; end if;
  insert into ai_usage (user_id, day, kind, count) values (auth.uid(), current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = ai_usage.count + 1
  returning count into n;
  return n <= p_limit;
end;
$$;
revoke all on function public.ai_take(text, integer) from public, anon;
grant execute on function public.ai_take(text, integer) to authenticated;

-- Which version of the terms/privacy policy the user accepted, and when.
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
