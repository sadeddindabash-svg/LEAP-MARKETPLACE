-- Migration 060: real sort_order for all 5 vehicle data levels
-- (brands, models, generations, engines, transmissions), same real
-- pattern as category_parts/product_categories already use. Existing
-- rows are backfilled with a sensible initial order (alphabetical,
-- scoped within each row's own real parent) rather than left at a
-- meaningless default of 0 for everything, which would make the very
-- first real reorder click behave unpredictably (multiple rows tied
-- at the same sort_order).

ALTER TABLE vehicle_brands ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE vehicle_models ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE vehicle_generations ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE vehicle_engines ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE vehicle_transmissions ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Real backfill: brands have no parent, ordered globally by name.
UPDATE vehicle_brands b
SET sort_order = ranked.rn * 10
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS rn FROM vehicle_brands) ranked
WHERE b.id = ranked.id;

-- Real backfill: models, scoped within their own real brand.
UPDATE vehicle_models m
SET sort_order = ranked.rn * 10
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY brand_id ORDER BY name ASC) AS rn FROM vehicle_models) ranked
WHERE m.id = ranked.id;

-- Real backfill: generations, scoped within their own real model.
UPDATE vehicle_generations g
SET sort_order = ranked.rn * 10
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY model_id ORDER BY year_start ASC) AS rn FROM vehicle_generations) ranked
WHERE g.id = ranked.id;

-- Real backfill: engines, scoped within their own real generation.
UPDATE vehicle_engines e
SET sort_order = ranked.rn * 10
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY generation_id ORDER BY name ASC) AS rn FROM vehicle_engines) ranked
WHERE e.id = ranked.id;

-- Real backfill: transmissions, scoped within their own real generation.
UPDATE vehicle_transmissions t
SET sort_order = ranked.rn * 10
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY generation_id ORDER BY name ASC) AS rn FROM vehicle_transmissions) ranked
WHERE t.id = ranked.id;
