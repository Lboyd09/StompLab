-- One row per Polar webhook-id we have accepted, so a replay is a no-op.
-- polar_event_at is the newest Polar event time applied to an entitlement, so an
-- older event that arrives late cannot overwrite a newer state.

create table if not exists polar_webhook_events (
  webhook_id text primary key,
  event_type text not null default '',
  received_at timestamptz not null default now()
);
create index if not exists polar_webhook_events_received_idx on polar_webhook_events (received_at);

alter table entitlements add column if not exists polar_event_at timestamptz;
