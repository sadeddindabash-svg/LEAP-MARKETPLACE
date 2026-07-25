-- Migration 046: real bilingual (English/Arabic) name and a real photo
-- for vehicle brands, and a real photo for product categories
-- (categories already had name_en/name_ar since migration 015).
--
-- Columns are nullable at the DB level -- existing rows (created
-- before this requirement existed) are not retroactively broken or
-- force-deleted. The REQUIRED-ness of nameAr/photoUrl for a brand, and
-- of photoUrl for a category, is enforced at the API layer on
-- CREATE going forward (see services/api/src/modules/fitment/routes.js
-- and services/api/src/modules/catalog/routes.js), not via a NOT NULL
-- constraint that would need a real backfill decision for old rows.

ALTER TABLE vehicle_brands ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE vehicle_brands ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS photo_url TEXT;
