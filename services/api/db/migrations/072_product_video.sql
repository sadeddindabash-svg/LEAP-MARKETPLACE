-- Migration 072: adds a real, single video_url column directly on
-- products, confirmed with the person directly: exactly one optional
-- product video (not multiple, unlike photos, which already have
-- their own separate product_images table for that exact reason) --
-- a single column is the right real shape here, not a new table.

ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT;
