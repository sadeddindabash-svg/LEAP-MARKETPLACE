-- Migration 108: the bulk parts catalog import, and the fields the catalog carries.
--
-- Everything here is "ADD COLUMN IF NOT EXISTS": it only adds what is missing and never touches what exists (a database may already have some of these columns, for
-- example the photos, which the admin screens have used for a long time).
--
--   code               a short permanent code (BRK for a category, BRK-001 for a part): how a sheet, a supplier file and the importer name the same thing without ambiguity.
--   name_zh            the Chinese name (the supplier portal is bilingual).
--   photo_url          the picture; until a real photo is added it points at a standard placeholder.
--   subcategory_*      the sub-category a part belongs to, in three languages (a part such as "Engine Oil 4 L" belongs to the sub-category "Engine Oil").
--   placement_*        where on the vehicle it fits, in three languages.   allowed_positions  the positions a product of this part may have, e.g. "Front; Rear".
--   applies_to, special_shipping, keywords_*   guides for filtering, carrier checks and search.
--   size_basis         'estimate' (a planning default) or 'measured' (confirmed by a person): the size and weight of a part are what a product's shipping is worked out from when
--                      the product has no complete set of its own, so an estimate must be recognisable and reviewable.
--   import_batch_id    which import created the row, so a wrong import can be undone (only for rows nothing uses).
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS import_batch_id TEXT;

ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS subcategory_en TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS subcategory_ar TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS subcategory_zh TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS placement_en TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS placement_ar TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS placement_zh TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS allowed_positions TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS applies_to TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS special_shipping TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS keywords_en TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS keywords_ar TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS keywords_zh TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS size_basis TEXT;
ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS import_batch_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'category_parts_size_basis_check') THEN
    ALTER TABLE category_parts ADD CONSTRAINT category_parts_size_basis_check CHECK (size_basis IS NULL OR size_basis IN ('estimate', 'measured'));
  END IF;
END $$;

-- a code names one category and one part, whatever its capitals
CREATE UNIQUE INDEX IF NOT EXISTS product_categories_code_key ON product_categories (lower(code)) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS category_parts_code_key ON category_parts (lower(code)) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS category_parts_batch_idx ON category_parts (import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_categories_batch_idx ON product_categories (import_batch_id) WHERE import_batch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog_import_batches (
  id               TEXT PRIMARY KEY,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       TEXT,
  file_name        TEXT,
  mode             TEXT NOT NULL DEFAULT 'skip',
  categories_added INTEGER NOT NULL DEFAULT 0,
  parts_added      INTEGER NOT NULL DEFAULT 0,
  parts_updated    INTEGER NOT NULL DEFAULT 0,
  undone_at        TIMESTAMPTZ
);
