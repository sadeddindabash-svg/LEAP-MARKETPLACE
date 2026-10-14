-- A weight and a package size for each CATEGORY, set by the admin and used automatically in the shipping cost.
--
-- Until now the supplier typed a weight and the length, width and height on every product, and the shipping cost (the "shipping_volumetric" fee: a rate times the
-- larger of the weight and length x width x height / 5000) read them from the product. Now the admin sets them once per category and every product in the category
-- uses them. A product that already has its OWN complete set keeps using it (so no existing price changes); a product without one uses its category's.
--
-- The four values are set TOGETHER or not at all, and each must be above zero: the shipping cost needs all four. The columns are NULLABLE so that categories created
-- before this change keep working until the admin sets theirs (the supplier then still enters the product's own, as before).
ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(8, 3),
  ADD COLUMN IF NOT EXISTS length_cm NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(8, 2);

ALTER TABLE product_categories
  ADD CONSTRAINT product_categories_shipping_all_or_none CHECK (
    (weight_kg IS NULL AND length_cm IS NULL AND width_cm IS NULL AND height_cm IS NULL)
    -- Each value is tested for "is present" EXPLICITLY: a comparison with an empty value is neither true nor false, and a CHECK lets "unknown" through,
    -- so "weight > 0 AND length > 0 ..." alone would have accepted a weight with the other three left empty.
    OR (weight_kg IS NOT NULL AND length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL
        AND weight_kg > 0 AND length_cm > 0 AND width_cm > 0 AND height_cm > 0)
  );
