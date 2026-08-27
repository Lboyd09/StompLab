create table if not exists rig_cache (
  cache_key text primary key,
  kind text not null,
  song text not null default '',
  artist text not null default '',
  instrument text not null default '',
  stomp_model text not null default '',
  query text not null default '',
  preset jsonb,
  matches jsonb,
  hit_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rig_cache_kind_updated_idx
  on rig_cache (kind, updated_at desc);
