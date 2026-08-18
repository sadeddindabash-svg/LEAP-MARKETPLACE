-- Migration 059: real photo for sub-categories (category_parts), same
-- real pattern already established for product_categories (migration
-- 046). Nullable at the DB level -- existing parts (created before
-- this requirement existed) are not retroactively broken; the mobile
-- app already falls back to a plain generic icon when this is null
-- (confirmed directly with the person before building this).

ALTER TABLE category_parts ADD COLUMN IF NOT EXISTS photo_url TEXT;
