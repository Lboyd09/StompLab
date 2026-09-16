-- One Polar 50% month gift per referred friend who starts paying.

alter table referral_redemptions
  add column if not exists subscribe_discount_at timestamptz;
