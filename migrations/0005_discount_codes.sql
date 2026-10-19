create table if not exists discount_codes (
  code text primary key,
  active boolean not null default true,
  total_percent numeric not null default 0,
  ride_percent numeric not null default 0,
  min_fare numeric not null default 0,
  night_percent numeric not null default 0,
  holiday_percent numeric not null default 0,
  wait_percent numeric not null default 0,
  meet_greet_free boolean not null default false
);

insert into discount_codes (
  code, active, total_percent, ride_percent, min_fare, night_percent, holiday_percent, wait_percent, meet_greet_free
) values
  ('RICCIO5', true, 5, 0, 0, 0, 0, 0, false),
  ('RICCIO10', true, 10, 0, 0, 0, 0, 0, false),
  ('RICCIO15', true, 15, 0, 0, 0, 0, 0, false),
  ('RICCIO20', true, 20, 0, 0, 0, 0, 0, false),
  ('CONVENZIONE20', true, 0, 20, 60, 5, 5, 5, true)
on conflict (code) do nothing;
