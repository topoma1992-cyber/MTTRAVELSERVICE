alter table staff_lock add column if not exists failed_attempts integer not null default 0;
alter table staff_lock add column if not exists recovery_hash text;
alter table staff_lock add column if not exists recovery_expires timestamptz;
