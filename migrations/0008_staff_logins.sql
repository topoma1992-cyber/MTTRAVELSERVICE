create table if not exists staff_logins (
  email text primary key,
  pin_hash text not null,
  owner boolean not null default false
);

insert into staff_logins (email, pin_hash, owner)
select 'info@mttravelservice.com', pin_hash, true
from staff_lock
where id = 1
on conflict (email) do nothing;

update staff_lock
set failed_attempts = 0, recovery_hash = null, recovery_expires = null
where id = 1;
