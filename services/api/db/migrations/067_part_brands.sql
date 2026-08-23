-- Migration 067: real part-manufacturer brands (e.g. MAHLE, RIDEX,
-- Hongqi) -- deliberately a SEPARATE real table from vehicle_brands,
-- which is real vehicle makes (BMW, Toyota) used for fitment, not the
-- real brand that manufactures the part itself. Confirmed directly
-- with the person: a small real logo badge on the product card,
-- requiring a real, structured brand entity with its own real logo,
-- not just free text embedded in a product's own name.
--
-- Nullable at the DB level, same real pattern as vehicle_brands
-- (migration 046) -- required-ness of name/logoUrl enforced at the
-- real API layer on CREATE, not a NOT NULL constraint needing a real
-- backfill decision.
CREATE TABLE IF NOT EXISTS part_brands (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  name_ar     TEXT,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nullable -- a real product not yet assigned a real brand is a
-- perfectly valid, existing state (every product created before this
-- migration), not an error.
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id TEXT REFERENCES part_brands(id);
