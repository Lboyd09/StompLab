-- Monthly/yearly Polar subscriptions + structured preset feedback.
-- Nobody has paid a one-time unlock; no grandfathering.

alter table entitlements add column if not exists polar_subscription_id text not null default '';
alter table entitlements add column if not exists plan_interval text not null default '';
alter table entitlements add column if not exists subscription_status text not null default '';

create index if not exists entitlements_subscription_idx
  on entitlements (polar_subscription_id)
  where polar_subscription_id <> '';

alter table feedback add column if not exists rating integer;
alter table feedback add column if not exists closer_tweaks text not null default '';
alter table feedback add column if not exists want_preset text not null default '';
alter table feedback add column if not exists want_app text not null default '';
