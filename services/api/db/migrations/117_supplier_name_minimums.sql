-- The minimum length of a supplier's product name, by the name's language, set by the admin (Products > Product requirements).
-- All characters count (spaces, digits and signs too); the maximum stays 100.
ALTER TABLE product_requirements ADD COLUMN IF NOT EXISTS name_min_en integer NOT NULL DEFAULT 15;
ALTER TABLE product_requirements ADD COLUMN IF NOT EXISTS name_min_zh integer NOT NULL DEFAULT 5;
ALTER TABLE product_requirements ADD COLUMN IF NOT EXISTS name_min_ar integer NOT NULL DEFAULT 15;
