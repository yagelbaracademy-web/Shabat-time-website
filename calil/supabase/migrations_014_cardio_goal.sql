-- Cardio in a plan: a time goal in minutes instead of sets × reps.
alter table public.template_exercises add column if not exists target_minutes integer check (target_minutes between 1 and 600);
