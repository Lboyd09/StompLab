-- Per-account setlists (ordered songs for a gig). Never share across user_id.
create table if not exists user_setlists (
  user_id text primary key,
  setlists jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
