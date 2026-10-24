-- An invite typed before the email is confirmed. Redeemed on the first signed-in
-- load after the account is confirmed, then deleted.
create table if not exists referral_pending (
  user_id text primary key,
  code text not null,
  created_at timestamptz not null default now()
);
