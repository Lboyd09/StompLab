create index if not exists build_events_user_month_idx
  on build_events (user_id, year_month);

create index if not exists build_events_month_idx
  on build_events (year_month);

create index if not exists build_events_created_idx
  on build_events (created_at);

create index if not exists entitlements_paid_idx
  on entitlements (paid, paid_source);

create index if not exists entitlements_email_idx
  on entitlements (email);

create index if not exists purchases_user_idx
  on purchases (user_id);

create index if not exists purchases_email_idx
  on purchases (email);

create index if not exists user_email_idx
  on "user" (email);

create index if not exists user_created_idx
  on "user" ("createdAt");

create index if not exists rig_cache_kind_song_idx
  on rig_cache (kind, song);
