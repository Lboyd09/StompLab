-- Extra custom builds from inviting a friend. One redemption per new account.

alter table entitlements
  add column if not exists bonus_builds integer not null default 0;

create table if not exists referrals (
  user_id text primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);
create unique index if not exists referrals_code_idx on referrals (code);

create table if not exists referral_redemptions (
  referred_user_id text primary key,
  referrer_user_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists referral_redemptions_referrer_idx on referral_redemptions (referrer_user_id);
