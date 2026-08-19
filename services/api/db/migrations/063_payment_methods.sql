-- Migration 063: real payment method management, with per-country
-- activation -- confirmed with the person before building: photo
-- required (matching brands/categories, not the optional pattern used
-- for parts/models), and deliberately started empty rather than
-- seeded with the 4 previously hardcoded methods (Visa/Mastercard,
-- Amazon Payment Services, PayPal, Google Pay) -- the admin will
-- re-add them manually through the new admin portal section.

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Real, deliberately presence-based rather than a boolean is_active
-- column -- a row existing here means this payment method is active
-- for this country; no row means inactive. This naturally matches
-- the confirmed "start empty" requirement: a newly created payment
-- method is active in zero countries until the admin explicitly
-- activates each one, with no separate "default active" state to
-- reason about.
CREATE TABLE IF NOT EXISTS payment_method_countries (
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  PRIMARY KEY (payment_method_id, country_code)
);
