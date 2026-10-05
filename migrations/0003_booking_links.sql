alter table bookings add column if not exists edit_token text;
alter table bookings add column if not exists revised boolean not null default false;

update bookings
set edit_token = substr(md5(id || random()::text), 1, 24)
where edit_token is null or edit_token = '';

create unique index if not exists bookings_edit_token_idx on bookings (edit_token);

create table if not exists staff_alerts (
  id int primary key,
  notify_email text not null default 'info@mttravelservice.com',
  smtp_user text not null default 'info@mttravelservice.com',
  smtp_pass text not null default ''
);

insert into staff_alerts (id) values (1) on conflict (id) do nothing;
