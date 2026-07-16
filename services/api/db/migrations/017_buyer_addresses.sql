-- Migration 017: real buyer addresses (BUY account -- "Addresses" was a
-- genuinely dead nav row before this, route: null, tapping it did
-- nothing at all).
--
-- CONFIRMED REQUIREMENT: a customer can have up to 3 real saved
-- addresses. The cap is enforced in application code (see
-- services/api/src/modules/addresses/routes.js), not a DB constraint --
-- same pattern as the mandatory-3-photos rule on product submission
-- elsewhere in this schema (a real, deliberate business rule, checked
-- where the real validation logic already lives, not encoded as a
-- rigid schema constraint that's harder to adjust later).
CREATE TABLE IF NOT EXISTS buyer_addresses (
  id              TEXT PRIMARY KEY,
  buyer_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,          -- e.g. "Home", "Work" -- free text, buyer's own name for it
  recipient_name  TEXT NOT NULL,
  phone           TEXT NOT NULL,
  country         TEXT NOT NULL,
  city            TEXT NOT NULL,
  street_address  TEXT NOT NULL,
  postal_code     TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buyer_addresses_buyer ON buyer_addresses(buyer_id);
