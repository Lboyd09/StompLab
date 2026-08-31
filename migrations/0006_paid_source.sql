-- Paid must come from a Polar order (or the one admin email), never checkout.created.
alter table entitlements add column if not exists paid_source text not null default '';

create table if not exists profiles (
  user_id text primary key,
  display_name text not null default '',
  instrument text not null default 'guitar',
  stomp_model text not null default 'hx-stomp',
  genres text not null default '',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
