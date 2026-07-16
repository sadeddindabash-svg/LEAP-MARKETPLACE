-- Migration 020: a general promotions engine, not just referral rewards.
--
-- CONFIRMED SCOPE, discussed at length before building: what started as
-- "referral rewards" was deliberately expanded into a real, general
-- coupon system once it became clear the actual need was broader --
-- admin-configurable codes for events/campaigns, not just referrals.
-- Referral rewards are ONE real source of promo codes within this same
-- system, not a separate, narrower thing that would need rebuilding the
-- first time a seasonal sale is wanted.
--
-- CONFIRMED DECISIONS:
-- - Reward types: percentage off, flat amount off, free shipping.
-- - Referral trigger: the referred person's FIRST real order (not mere
--   signup) -- a real deterrent against trivial fake-account abuse,
--   confirmed as the safer choice discussed directly.
-- - Cap: a referrer can earn at most 10 real rewards.
-- - One code per order -- no stacking multiple codes on a single order.

CREATE TABLE IF NOT EXISTS referral_codes (
  code       TEXT PRIMARY KEY,
  buyer_id   TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id               SERIAL PRIMARY KEY,
  referrer_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, -- a real person can only ever be referred once
  referral_code    TEXT NOT NULL REFERENCES referral_codes(code),
  reward_granted   BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

CREATE TABLE IF NOT EXISTS promo_codes (
  code                TEXT PRIMARY KEY,
  type                TEXT NOT NULL CHECK (type IN ('percentage', 'flat', 'free_shipping')),
  value               NUMERIC, -- percentage (e.g. 10) or flat USD amount; NULL for free_shipping
  source              TEXT NOT NULL CHECK (source IN ('admin', 'referral')),
  created_by_admin_id TEXT REFERENCES users(id), -- NULL for a real referral-generated code
  max_total_uses      INTEGER, -- NULL = unlimited
  max_uses_per_buyer  INTEGER NOT NULL DEFAULT 1,
  expires_at          TIMESTAMPTZ, -- NULL = never expires
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id          SERIAL PRIMARY KEY,
  promo_code  TEXT NOT NULL REFERENCES promo_codes(code),
  buyer_id    TEXT REFERENCES users(id),
  order_id    TEXT REFERENCES orders(id), -- set once genuinely applied to a real placed order
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON promo_code_redemptions(promo_code);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_buyer ON promo_code_redemptions(buyer_id, promo_code);

-- Real referral rewards notify the referrer (see
-- services/api/src/modules/promotions/helpers.js's
-- checkAndGrantReferralReward) — the notifications table's real CHECK
-- constraint (migration 019) only allowed the 4 original trigger types,
-- so it needs a real 5th value added here rather than the new type
-- silently failing to insert.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('order_status', 'return_status', 'ticket_reply', 'supplier_message', 'referral_reward'));

-- Real, honest auditability: which real promo code (if any) was
-- applied to this order, and exactly how much real discount it
-- produced -- not just trusting the final total to explain itself.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT REFERENCES promo_codes(code);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;
