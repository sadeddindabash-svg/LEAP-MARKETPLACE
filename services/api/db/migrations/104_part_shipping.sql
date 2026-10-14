-- The weight and package size belong to each PART (the sub-category: "Front Brake Disc" under "Brake System"), not to the major category.
--
-- Migration 103 put them on categories. A category such as "Brake System" holds parts of very different sizes, so they move down to the parts. A product refers to its
-- part by NAME (products.category + products.part, migration 015), and part names are unique within a category (migration 101), so a product's part is always found.
--
-- Nothing is lost and no price changes: every value already set on a category is COPIED to each of its parts that has none, and only then removed from the category.
-- The four values are set TOGETHER or not at all, each above zero (the shipping cost needs all four). The columns are NULLABLE so a part without values keeps working
-- until the admin sets them (the supplier then still enters the product's own, as before).
ALTER TABLE category_parts
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(8, 3),
  ADD COLUMN IF NOT EXISTS length_cm NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(8, 2);

ALTER TABLE category_parts
  ADD CONSTRAINT category_parts_shipping_all_or_none CHECK (
    (weight_kg IS NULL AND length_cm IS NULL AND width_cm IS NULL AND height_cm IS NULL)
    -- Each value is tested for "is present" EXPLICITLY: a comparison with an empty value is neither true nor false, and a CHECK lets "unknown" through.
    OR (weight_kg IS NOT NULL AND length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL
        AND weight_kg > 0 AND length_cm > 0 AND width_cm > 0 AND height_cm > 0)
  );

-- Copy down what was set on a category (migration 103) to its parts that have no values of their own yet.
UPDATE category_parts cp
SET weight_kg = pc.weight_kg, length_cm = pc.length_cm, width_cm = pc.width_cm, height_cm = pc.height_cm
FROM product_categories pc
WHERE pc.id = cp.category_id AND pc.weight_kg IS NOT NULL AND cp.weight_kg IS NULL;

-- Categories no longer carry them.
ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS product_categories_shipping_all_or_none;
ALTER TABLE product_categories
  DROP COLUMN IF EXISTS weight_kg,
  DROP COLUMN IF EXISTS length_cm,
  DROP COLUMN IF EXISTS width_cm,
  DROP COLUMN IF EXISTS height_cm;
