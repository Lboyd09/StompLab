-- Per-account history. Never share presets across user_id.
create table if not exists user_presets (
  user_id text primary key,
  presets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists affiliate_clicks (
  id serial primary key,
  user_id text not null default '',
  vendor text not null,
  query text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_created_idx on affiliate_clicks (created_at desc);
