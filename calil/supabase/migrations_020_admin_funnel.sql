-- Activation funnel for the admin dashboard: how far new people get. Test accounts are left out.
create or replace function public.admin_funnel()
returns jsonb language sql security definer set search_path = public, auth as $$
  with u as (
    select id from auth.users
    where email not like 'calil.%@example.com' and email not like '%@example.org'
  ),
  done_sets as (
    select distinct w.user_id from sets s
    join workout_exercises we on we.id = s.workout_exercise_id
    join workouts w on w.id = we.workout_id
    where s.completed
  ),
  finished as (select user_id, count(*) n from workouts where completed_at is not null group by user_id)
  select jsonb_build_object(
    'signed_up', (select count(*) from u),
    'consented', (select count(*) from profiles p join u on u.id = p.id where p.terms_accepted_at is not null),
    'first_set', (select count(*) from done_sets d join u on u.id = d.user_id),
    'dictated', (select count(distinct a.user_id) from ai_usage a join u on u.id = a.user_id where a.kind = 'dictate' and a.count > 0),
    'finished', (select count(*) from finished f join u on u.id = f.user_id),
    'returning', (select count(*) from finished f join u on u.id = f.user_id where f.n >= 3)
  ); $$;
revoke all on function public.admin_funnel() from public, anon, authenticated;
grant execute on function public.admin_funnel() to service_role;
