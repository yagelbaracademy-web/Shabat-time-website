-- A plan can carry a starting weight per exercise (e.g. from an imported program);
-- it prefills the sets the first time, until there's history to copy from.
alter table public.template_exercises add column if not exists target_weight numeric(6,2) check (target_weight >= 0);
