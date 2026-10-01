-- Product analytics: which buttons people see and use, and what happens next.
-- Each row: when, an event name ("tap:Add set", "seen:Add set", "do:dictate_voice", "view:/plans"),
-- the screen, and a pseudonymous actor (salted hash of the user id; never the id or email).
-- No workout content and no typed text is ever recorded.

create table if not exists public.analytics_salt (id int primary key default 1 check (id = 1), salt text not null);
insert into public.analytics_salt (salt) values (encode(gen_random_bytes(24), 'hex')) on conflict (id) do nothing;
alter table public.analytics_salt enable row level security; -- no policies

create table if not exists public.usage_events (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  event    text not null check (char_length(event) between 1 and 80),
  screen   text check (char_length(screen) <= 40),
  actor    text not null,
  internal boolean not null default false -- the owner's own use, so it can be shown or hidden
);
create index if not exists usage_events_at on public.usage_events (at);
create index if not exists usage_events_event on public.usage_events (event);
alter table public.usage_events enable row level security; -- no policies: written by track_batch only

create or replace function public.track_batch(events jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  em text;
  who text;
  is_internal boolean;
begin
  if auth.uid() is null or jsonb_typeof(events) <> 'array' then return; end if;
  select email into em from auth.users where id = auth.uid();
  if em like 'calil.%@example.com' then return; end if; -- automated test accounts
  is_internal := em = any (array['baryagel64@gmail.com']);
  who := left(encode(digest(auth.uid()::text || (select salt from analytics_salt), 'sha256'), 'hex'), 16);
  insert into usage_events (at, event, screen, actor, internal)
  select least(now(), coalesce((e->>'at')::timestamptz, now())), left(e->>'event', 80), left(e->>'screen', 40), who, is_internal
  from jsonb_array_elements(events) e
  where coalesce(e->>'event', '') <> ''
  limit 200;
end; $$;
revoke all on function public.track_batch(jsonb) from public, anon;
grant execute on function public.track_batch(jsonb) to authenticated;

-- Per event over the last 30 days. with_me=false leaves out the owner's own use.
create or replace function public.admin_insights(with_me boolean default true)
returns jsonb language sql security definer set search_path = public as $$
  with e as (select * from usage_events where at > now() - interval '30 days' and (with_me or not internal)),
  people as (select count(distinct actor) as n from e)
  select jsonb_build_object(
    'people_30d', (select n from people),
    'events_30d', (select count(*) from e),
    'rows', coalesce((select jsonb_agg(r order by (r->>'uses')::int desc) from (
      select jsonb_build_object(
        'event', event,
        'uses', count(*),
        'users', count(distinct actor),
        'days', count(distinct (at at time zone 'Asia/Jerusalem')::date),
        'last', max(at),
        'first', min(at),
        'screens', (select jsonb_agg(distinct s) from (select screen s from e e2 where e2.event = e.event and screen is not null limit 50) x)
      ) as r
      from e group by event
    ) y), '[]'::jsonb)
  ); $$;
revoke all on function public.admin_insights(boolean) from public, anon, authenticated;
grant execute on function public.admin_insights(boolean) to service_role;
