-- 2026-10-01: program import
-- Names the user actually says ("the yellow row machine") so search and dictation find the exercise.
alter table public.exercises add column if not exists aliases text[] not null default '{}';
-- Coach / plan notes per exercise (tempo, RPE, set type, setup). Optional.
alter table public.template_exercises add column if not exists note text;
