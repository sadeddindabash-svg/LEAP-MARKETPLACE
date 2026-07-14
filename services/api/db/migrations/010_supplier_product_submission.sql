-- Migration 010: structured supplier product submission
--   Brand -> Model -> Generation -> Year -> Engine -> Transmission cascade,
--   Category/Part/Position/OEM Number classification, mandatory photos,
--   and Chinese-original / English-translation storage for the admin
--   approval workflow.
--
-- IMPORTANT: this is a SEPARATE, richer reference hierarchy from the
-- existing `vehicles` table (migration 001) — `vehicles` is a flat
-- Year/Make/Model/Trim catalog used by the buyer-facing Garage feature
-- and basic catalog fitment filter; it is NOT touched or replaced here.
-- This migration adds the deeper Brand->Model->Generation->Engine-
-- >Transmission cascade specifically for the supplier product-submission
-- flow, where a supplier needs to pick a much more precise fitment claim
-- than "which car do you own" (a buyer's concern) requires. The two
-- systems intentionally coexist; unifying them is a larger future
-- migration, not something to rush here at the cost of breaking either
-- existing consumer.

CREATE TABLE IF NOT EXISTS vehicle_brands (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id        TEXT PRIMARY KEY,
  brand_id  TEXT NOT NULL REFERENCES vehicle_brands(id) ON DELETE CASCADE,
  name      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_brand ON vehicle_models(brand_id);

CREATE TABLE IF NOT EXISTS vehicle_generations (
  id          TEXT PRIMARY KEY,
  model_id    TEXT NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  name        TEXT NOT NULL, -- e.g. 'F20'
  year_start  INTEGER NOT NULL,
  year_end    INTEGER, -- NULL means "still in production"
  CONSTRAINT valid_year_range CHECK (year_end IS NULL OR year_end >= year_start)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_generations_model ON vehicle_generations(model_id);

CREATE TABLE IF NOT EXISTS vehicle_engines (
  id             TEXT PRIMARY KEY,
  generation_id  TEXT NOT NULL REFERENCES vehicle_generations(id) ON DELETE CASCADE,
  name           TEXT NOT NULL -- e.g. '118d 2.0 Diesel'
);
CREATE INDEX IF NOT EXISTS idx_vehicle_engines_generation ON vehicle_engines(generation_id);

CREATE TABLE IF NOT EXISTS vehicle_transmissions (
  id             TEXT PRIMARY KEY,
  generation_id  TEXT NOT NULL REFERENCES vehicle_generations(id) ON DELETE CASCADE,
  name           TEXT NOT NULL -- e.g. '6-Speed Manual'
);
CREATE INDEX IF NOT EXISTS idx_vehicle_transmissions_generation ON vehicle_transmissions(generation_id);

-- A submitted product's specific fitment claim(s). Many-to-many: one
-- product can fit multiple generation/engine/transmission combinations,
-- one supplier submission adds at least one.
CREATE TABLE IF NOT EXISTS product_fitment_entries (
  id                SERIAL PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  generation_id     TEXT NOT NULL REFERENCES vehicle_generations(id),
  year              INTEGER NOT NULL,
  engine_id         TEXT REFERENCES vehicle_engines(id),       -- NULL = fits any engine in that generation
  transmission_id   TEXT REFERENCES vehicle_transmissions(id)  -- NULL = fits any transmission in that generation
);
CREATE INDEX IF NOT EXISTS idx_product_fitment_entries_product ON product_fitment_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_product_fitment_entries_generation ON product_fitment_entries(generation_id);

-- Mandatory photos. The "at least 3" rule is enforced at the APPLICATION
-- layer (in the product-creation endpoint), not a DB constraint — a
-- CHECK constraint can't cheaply express "at least 3 rows exist in a
-- different table" without a trigger, and the validation needs to run
-- before the product is created anyway (reject the whole submission, not
-- allow a product to exist with too few photos and clean up after).
CREATE TABLE IF NOT EXISTS product_images (
  id          SERIAL PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- Bilingual name/description storage for the translation-approval
-- workflow. `products.name` (from migration 001) continues to be the
-- REAL, DISPLAYED name (English, or whatever the platform's display
-- language is) -- name_zh is the supplier's original Chinese submission,
-- kept alongside it so admin reviewers can see exactly what was
-- submitted when approving the translation into `name`.
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_zh TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS part TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS oem_number TEXT;
