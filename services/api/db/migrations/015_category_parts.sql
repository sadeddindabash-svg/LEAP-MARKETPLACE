-- Migration 015: real category + part reference lists
--
-- CONFIRMED REQUIREMENT: categories and the specific parts/products that
-- belong to each one are now real, admin-managed reference data — a
-- supplier picks from a real list (per the confirmed requirement),
-- rather than typing free text into a "Part" field. Same structural
-- idea as the Vehicle Data fitment cascade (migration 010), just two
-- levels instead of four.
--
-- BACKWARD COMPATIBLE BY DESIGN: `product_categories.id` values match
-- the EXISTING hardcoded category identifiers this whole project has
-- used since migration 001 ('brake', 'engine', 'electrical', 'filters',
-- 'suspension', 'lighting') — every existing product's `category` value
-- continues to mean exactly what it already meant, no data migration
-- needed for existing rows. `products.part` is NOT changed to a foreign
-- key — it stays plain text (same pattern as `category`/`position`
-- elsewhere in this schema), but going forward its value is validated
-- against `category_parts` in application code (see the supplier
-- module), not left as arbitrary free text. This avoids a large
-- blast-radius change to every place that already reads `product.part`
-- as plain display text (catalog, search, admin order line items).
CREATE TABLE IF NOT EXISTS product_categories (
  id         TEXT PRIMARY KEY,
  name_en    TEXT NOT NULL,
  name_ar    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_parts (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES product_categories(id),
  name_en     TEXT NOT NULL,
  name_ar     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_category_parts_category ON category_parts(category_id);
