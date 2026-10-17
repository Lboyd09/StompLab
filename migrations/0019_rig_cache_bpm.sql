-- The studio tempo found for a cached song, so a cache hit does not ask the model again.

alter table rig_cache add column if not exists bpm integer;
