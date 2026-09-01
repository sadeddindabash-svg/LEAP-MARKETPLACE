-- Migration 077: adds two real, separate things confirmed with the
-- person through several rounds of clarification before building:
--
-- 1. product_attributes -- a fully flexible key/value system
--    (confirmed explicitly, not a fixed list), letting a supplier
--    add whatever real spec matters for their specific part (color,
--    material, side, etc.) -- different real part types genuinely
--    need different real attributes, not one fixed set that doesn't
--    fit every category. One real value per (product, name) pair.
--    Confirmed: shown only digitally in the hub-mobile app after
--    scanning, not printed on the physical label itself.
--
-- 2. received_quantity on order_line_items -- lets a hub worker
--    record the real, actual quantity counted on arrival, separate
--    from the real quantity that was originally ordered (the
--    existing `quantity` column). NULL means not yet checked.
--    Confirmed explicitly: a genuine mismatch is shown as a visual
--    warning only -- never auto-flags the shipment; the hub worker
--    decides for themselves whether to actually flag it.

CREATE TABLE IF NOT EXISTS product_attributes (
  product_id       TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_name    TEXT NOT NULL,
  attribute_value   TEXT NOT NULL,
  PRIMARY KEY (product_id, attribute_name)
);

ALTER TABLE order_line_items ADD COLUMN IF NOT EXISTS received_quantity INTEGER;
