create table if not exists site_visits (
  day date not null,
  visitor_key text not null,
  hits int not null default 1,
  created_at timestamptz not null default now(),
  primary key (day, visitor_key)
);

create index if not exists site_visits_day_idx on site_visits (day);
