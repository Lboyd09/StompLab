-- Download beacon for the admin funnel. Only a user id (empty when signed out) and the kind.
create table if not exists download_events (
  id bigserial primary key,
  user_id text not null default '',
  kind text not null default 'download',
  created_at timestamptz not null default now()
);
create index if not exists download_events_created_idx on download_events (created_at);
create index if not exists download_events_user_idx on download_events (user_id, created_at);
