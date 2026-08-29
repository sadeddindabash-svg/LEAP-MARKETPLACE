-- Migration 074: replaces the previous per-product original_price
-- column (migration 073) with a real, admin-controlled bulk discount-
-- rules engine, confirmed with the person through several rounds of
-- design: suppliers no longer set any discount at all -- admins
-- create rules matching a vehicle brand (required), optionally
-- narrowed further by a specific model within that brand, optionally
-- narrowed further still by a year range. A product gets the
-- matching rule's discount if ANY of its own fitment entries (not
-- just its primary one) falls within a rule's real criteria.
--
-- Dropping original_price entirely rather than leaving it unused --
-- it was never live in production, and the real source of truth for
-- a discount is now this rules table, not a stored per-product value
-- (avoids the real column silently drifting from what the matching
-- rules would compute).

ALTER TABLE products DROP COLUMN IF EXISTS original_price;

-- brand_id is deliberately NOT NULL (confirmed with the person: every
-- real rule requires at least a brand) -- model_id and the year range
-- are the optional, narrowing refinements. year_from/year_to being
-- both NULL means "any year"; either alone means an open-ended range.
CREATE TABLE IF NOT EXISTS discount_rules (
  id                    SERIAL PRIMARY KEY,
  brand_id              TEXT NOT NULL REFERENCES vehicle_brands(id),
  model_id              TEXT REFERENCES vehicle_models(id),
  year_from             INTEGER,
  year_to               INTEGER,
  discount_percentage   NUMERIC(5, 2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage < 100),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (year_from IS NULL OR year_to IS NULL OR year_from <= year_to)
);

CREATE INDEX IF NOT EXISTS idx_discount_rules_brand ON discount_rules(brand_id);
