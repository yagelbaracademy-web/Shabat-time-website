-- 2026-10-01: admin dashboard (read-only aggregates), admin access log, AI failure counts

alter table public.ai_usage add column if not exists failed integer not null default 0;

create or replace function public.ai_fail(p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into ai_usage (user_id, day, kind, count, failed) values (auth.uid(), current_date, p_kind, 0, 1)
  on conflict (user_id, day, kind) do update set failed = ai_usage.failed + 1;
end; $$;
revoke all on function public.ai_fail(text) from public, anon;
grant execute on function public.ai_fail(text) to authenticated;

-- Who opened the admin dashboard, when (Data Security Regulations: log privileged access).
create table if not exists public.admin_log (
  id         bigint generated always as identity primary key,
  admin_id   uuid not null,
  action     text not null,
  created_at timestamptz not null default now()
);
alter table public.admin_log enable row level security; -- no policies: only the service role can touch it

-- All dashboard numbers in one call. Callable only with the service role (server side).
create or replace function public.admin_stats()
returns jsonb language sql security definer set search_path = public, auth as $$
with
  u as (select id, email, created_at, last_sign_in_at, email_confirmed_at,
               coalesce(raw_app_meta_data->>'provider', 'email') as provider from auth.users),
  w as (select id, user_id, started_at, completed_at from public.workouts),
  days as (select generate_series(current_date - 29, current_date, interval '1 day')::date as d)
select jsonb_build_object(
  'generated_at', now(),
  'users', jsonb_build_object(
    'total', (select count(*) from u),
    'confirmed', (select count(*) from u where email_confirmed_at is not null),
    'new_7d', (select count(*) from u where created_at > now() - interval '7 days'),
    'new_30d', (select count(*) from u where created_at > now() - interval '30 days'),
    'google', (select count(*) from u where provider = 'google'),
    'consented', (select count(*) from public.profiles where terms_accepted_at is not null)
  ),
  'active', jsonb_build_object(
    'd1', (select count(distinct user_id) from w where started_at > now() - interval '1 day'),
    'd7', (select count(distinct user_id) from w where started_at > now() - interval '7 days'),
    'd30', (select count(distinct user_id) from w where started_at > now() - interval '30 days'),
    -- of users who joined 14+ days ago, how many logged a workout in their second week
    'eligible_week2', (select count(*) from u where created_at < now() - interval '14 days'),
    'retained_week2', (select count(*) from u where created_at < now() - interval '14 days' and exists (
        select 1 from w where w.user_id = u.id and w.started_at between u.created_at + interval '7 days' and u.created_at + interval '14 days'))
  ),
  'totals', jsonb_build_object(
    'workouts', (select count(*) from w where completed_at is not null),
    'sets', (select count(*) from public.sets where completed),
    'plans', (select count(*) from public.workout_templates),
    'custom_exercises', (select count(*) from public.exercises where user_id is not null)
  ),
  'daily', (select jsonb_agg(jsonb_build_object(
      'day', d,
      'signups', (select count(*) from u where created_at::date = d),
      'workouts', (select count(*) from w where started_at::date = d),
      'active', (select count(distinct user_id) from w where started_at::date = d),
      'dictate', (select coalesce(sum(count), 0) from public.ai_usage where day = d and kind = 'dictate'),
      'import', (select coalesce(sum(count), 0) from public.ai_usage where day = d and kind = 'import'),
      'failed', (select coalesce(sum(failed), 0) from public.ai_usage where day = d)
    ) order by d) from days),
  'ai_30d', jsonb_build_object(
    'dictate', (select coalesce(sum(count), 0) from public.ai_usage where kind = 'dictate' and day > current_date - 30),
    'import', (select coalesce(sum(count), 0) from public.ai_usage where kind = 'import' and day > current_date - 30),
    'failed', (select coalesce(sum(failed), 0) from public.ai_usage where day > current_date - 30),
    'hit_limit_users', (select count(distinct user_id) from public.ai_usage where day > current_date - 30 and
        ((kind = 'dictate' and count >= 300) or (kind = 'import' and count >= 20)))
  ),
  'storage', jsonb_build_object('db_bytes', pg_database_size(current_database())),
  'user_list', (select coalesce(jsonb_agg(row order by row->>'joined' desc), '[]'::jsonb) from (
      select jsonb_build_object(
        'email', u.email, 'joined', u.created_at, 'provider', u.provider,
        'last_sign_in', u.last_sign_in_at, 'confirmed', u.email_confirmed_at is not null,
        'workouts', (select count(*) from w where w.user_id = u.id and w.completed_at is not null),
        'last_workout', (select max(started_at) from w where w.user_id = u.id),
        'consent', (select terms_version from public.profiles p where p.id = u.id),
        'ai_30d', (select coalesce(sum(count), 0) from public.ai_usage a where a.user_id = u.id and a.day > current_date - 30)
      ) as row from u) x)
); $$;
revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to service_role;
