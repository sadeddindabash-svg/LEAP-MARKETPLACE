-- Migration 024: real return window + real payouts foundation.
--
-- CONFIRMED SCOPE, discussed and refined before building: no automatic
-- payout SCHEDULE (real payout timing varies per supplier based on
-- individual agreements, not one platform-wide schedule) -- instead, a
-- real, admin-driven "record a payout" action, built on top of a real,
-- accurate "amount currently owed" calculation per supplier. Commission
-- varies by category (matching what was already a real placeholder in
-- Settings, now made genuinely real and editable).
--
-- CONFIRMED: a real "return window" (admin-configurable, constrained to
-- 3-7 days) determines both (a) the real deadline for a buyer to file a
-- return case at all -- previously unlimited, a real gap this closes --
-- and (b) when an order genuinely becomes eligible for payout: only
-- once delivered AND the window has passed AND no return case was ever
-- filed for it. This avoids needing a clawback/repayment system for a
-- return that happens after a supplier's already been paid.

-- A real, generic key-value settings table -- the return window is the
-- first real use, but this is intentionally reusable for future simple
-- admin-configurable values rather than a one-off dedicated column.
CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (key, value) VALUES ('return_window_days', '7') ON CONFLICT (key) DO NOTHING;

-- Real delivery timestamp -- didn't exist before this migration. Needed
-- to know how many real days have passed since delivery, for both the
-- real return-window deadline and real payout eligibility.
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Makes the Settings page's real "Commission rules" card genuinely
-- editable and genuinely used in the real payout calculation below --
-- before this migration, those percentages were hardcoded, fake
-- display-only numbers, never actually applied to anything.
--
-- The real starting values below are for an EXISTING database
-- upgrading through this migration, where these category rows already
-- exist -- on a genuinely FRESH database, db/seed.js sets these same
-- real values directly in its own INSERT when it creates these rows
-- (migrations run before seeding, so an UPDATE here would silently
-- match zero rows on a fresh setup -- the same real timing bug already
-- found once before, for the seeded admin's is_owner flag).
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS commission_percent NUMERIC NOT NULL DEFAULT 11;
UPDATE product_categories SET commission_percent = 12 WHERE id = 'brake';
UPDATE product_categories SET commission_percent = 14 WHERE id = 'engine';
UPDATE product_categories SET commission_percent = 13 WHERE id = 'electrical';
UPDATE product_categories SET commission_percent = 10 WHERE id = 'filters';

-- A real, admin-recorded payout to one supplier.
CREATE TABLE IF NOT EXISTS payouts (
  id                  SERIAL PRIMARY KEY,
  supplier_id         TEXT NOT NULL REFERENCES suppliers(id),
  amount              NUMERIC NOT NULL CHECK (amount > 0),
  currency_code       TEXT NOT NULL DEFAULT 'USD',
  notes               TEXT,
  created_by_admin_id TEXT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Real, permanent link between a payout and exactly which real
-- sub-orders it covered -- the UNIQUE constraint on sub_order_id is
-- the real safeguard against double-counting the same sub-order into
-- two different payouts.
CREATE TABLE IF NOT EXISTS payout_sub_orders (
  payout_id    INTEGER NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  sub_order_id INTEGER NOT NULL UNIQUE REFERENCES supplier_sub_orders(id)
);
