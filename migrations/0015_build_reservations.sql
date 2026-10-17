-- Reserve a build before the model call, confirm it after, release it on failure.
-- Existing rows are real builds, so they default to 'confirmed'.

alter table build_events add column if not exists status text not null default 'confirmed';

create index if not exists build_events_status_idx on build_events (user_id, status, created_at);
