create table if not exists feedback (
  id serial primary key,
  user_id text not null default '',
  email text not null default '',
  kind text not null default 'site',
  message text not null,
  song text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on feedback (created_at desc);
