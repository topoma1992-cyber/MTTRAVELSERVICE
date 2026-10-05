create table if not exists staff_lock (
  id int primary key,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id text primary key,
  code text not null,
  created_at timestamptz not null default now(),
  status text not null default 'pending',
  payment_method text not null,
  payment_link text not null default '',
  trip jsonb not null,
  customer jsonb not null,
  quote jsonb not null
);

create index if not exists bookings_created_at_idx on bookings (created_at desc);
