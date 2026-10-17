-- Small shared counter for abuse limits (reset mail, delete mail, feedback).

create table if not exists rate_limit_hits (
  id bigserial primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_bucket_idx on rate_limit_hits (bucket, created_at);
