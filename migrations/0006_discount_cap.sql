alter table discount_codes add column if not exists max_discount numeric not null default 0;
