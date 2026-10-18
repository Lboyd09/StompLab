-- Structured feedback: unit, part, what was off, and the preset the player downloaded.
alter table feedback add column if not exists context jsonb;
