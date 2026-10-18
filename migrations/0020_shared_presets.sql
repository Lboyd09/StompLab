-- Preset share links. One row per shared preset; share_id is the unguessable public id.
-- user_id is never returned to viewers.

create table if not exists shared_presets (
  share_id text primary key,
  user_id text not null,
  preset jsonb not null,
  song text,
  artist text,
  stomp_model text,
  created_at timestamptz not null default now()
);
create index if not exists shared_presets_user_idx on shared_presets (user_id, created_at);
