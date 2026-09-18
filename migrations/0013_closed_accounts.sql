-- 14-day recreate block after a confirmed delete. Cancel-at-period-end timestamp.

alter table entitlements
  add column if not exists current_period_end timestamptz;

create table if not exists closed_accounts (
  email_canonical text primary key,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  recreate_after timestamptz not null,
  confirm_token text unique,
  status text not null default 'pending_email',
  user_id text
);

alter table closed_accounts add column if not exists user_id text;

create index if not exists closed_accounts_token_idx on closed_accounts (confirm_token);
create index if not exists closed_accounts_recreate_idx on closed_accounts (recreate_after);
create index if not exists closed_accounts_user_idx on closed_accounts (user_id);
