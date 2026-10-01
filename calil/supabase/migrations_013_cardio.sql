-- Cardio: a set can hold a time and a distance instead of weight × reps.
alter table public.sets add column if not exists duration_seconds integer check (duration_seconds between 0 and 86400);
alter table public.sets add column if not exists distance numeric(7,2) check (distance >= 0);

-- Built-in cardio exercises (muscle group 'Cardio' is what marks an exercise as cardio).
insert into public.exercises (id, user_id, name, muscle_group, equipment) values
  ('dc7ed569-0545-545f-ad93-c9a7f3014639', null, 'Running', 'Cardio', 'bodyweight'),
  ('aa43bf29-b6d0-5489-af00-7c789d6c5b3b', null, 'Treadmill', 'Cardio', 'machine'),
  ('050321fc-d7a0-5590-b25a-451b1f1f3231', null, 'Walking', 'Cardio', 'bodyweight'),
  ('31f33ee1-7b4c-57af-8039-0d6ffd8e26a6', null, 'Stationary Bike', 'Cardio', 'machine'),
  ('9fe4a8e6-7445-5bb3-81ea-89d10df02181', null, 'Elliptical', 'Cardio', 'machine'),
  ('2f9c7a7f-d5b6-5c64-acf2-bf520362f35c', null, 'Rowing Machine', 'Cardio', 'machine'),
  ('a26a82ce-2374-55aa-af3e-a92e6499a637', null, 'Stair Climber', 'Cardio', 'machine'),
  ('0cb77901-bbf4-579f-90da-328e1cb64c12', null, 'Jump Rope', 'Cardio', 'other')
on conflict (id) do nothing;
