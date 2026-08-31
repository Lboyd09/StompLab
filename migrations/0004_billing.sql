-- Paid unlock + usage. user_id is Better Auth text id.

create table if not exists entitlements (
  user_id text primary key,
  email text not null default '',
  paid boolean not null default false,
  polar_customer_id text not null default '',
  polar_order_id text not null default '',
  amount_cents integer not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entitlements_email_idx on entitlements (email);

create table if not exists purchases (
  id serial primary key,
  user_id text not null,
  email text not null default '',
  polar_order_id text not null default '',
  polar_checkout_id text not null default '',
  amount_cents integer not null default 0,
  raw jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists purchases_polar_checkout_idx on purchases (polar_checkout_id) where polar_checkout_id <> '';

create table if not exists build_events (
  id serial primary key,
  user_id text not null,
  kind text not null,
  song text not null default '',
  year_month text not null,
  created_at timestamptz not null default now()
);
create index if not exists build_events_user_month_idx on build_events (user_id, year_month);
create index if not exists build_events_user_idx on build_events (user_id);

create table if not exists research_failures (
  id serial primary key,
  user_id text not null default '',
  song text not null default '',
  artist text not null default '',
  error text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists research_failures_created_idx on research_failures (created_at desc);

create table if not exists user_gear (
  user_id text primary key,
  gear jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
