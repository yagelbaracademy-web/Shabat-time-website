-- Anonymous feature counters: which parts of the app get used, per day.
-- No user id is stored, only (day, event, count).
create table if not exists public.usage_counts (
  day   date    not null default current_date,
  event text    not null check (event ~ '^[a-z_]{1,32}$'),
  count integer not null default 0,
  primary key (day, event)
);
alter table public.usage_counts enable row level security; -- no policies: only the functions below touch it

create or replace function public.track(ev text)
returns void language sql security definer set search_path = public as $$
  insert into public.usage_counts (day, event, count) values (current_date, ev, 1)
  on conflict (day, event) do update set count = public.usage_counts.count + 1;
$$;
revoke all on function public.track(text) from public, anon;
grant execute on function public.track(text) to authenticated;

create or replace function public.admin_usage()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(row order by (row->>'d30')::int desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'event', event,
      'today', coalesce(sum(count) filter (where day = current_date), 0),
      'd7', coalesce(sum(count) filter (where day > current_date - 7), 0),
      'd30', coalesce(sum(count) filter (where day > current_date - 30), 0),
      'total', sum(count)
    ) as row
    from public.usage_counts group by event
  ) x;
$$;
revoke all on function public.admin_usage() from public, anon, authenticated;
grant execute on function public.admin_usage() to service_role;
