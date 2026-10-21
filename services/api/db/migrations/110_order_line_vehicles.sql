-- Migration 110: which CAR each part of an order is for, as the supplier sees it.
--
-- When an order is placed, the server reads the buyer's My Garage and records, for each order line, the car the part is for (the buyer does nothing new). It is a SNAPSHOT: the names, engine,
-- seats and a photo address are copied at that moment, so later edits to the vehicle data, or to the buyer's garage, never change what the supplier was told. The car's ids are kept as well,
-- only to look the photo up live (a replaced photo never leaves a broken link); they are deliberately NOT foreign keys, so deleting a vehicle can never break an old order.
--
--   status   listed      the product's fitment list includes this car (the same rule as "Confirmed fit" on the website)
--            not_listed  the product has a fitment list but this car is not on it: the supplier is asked to check
--            no_car      the product is made for specific cars but the buyer has no car in My Garage (or is a guest)
--            universal   the product has no fitment list (it fits any car): no car is recorded
-- One row per order line; deleting an order line removes its row. Safe to run more than once.
CREATE TABLE IF NOT EXISTS order_line_vehicles (
  line_item_id   INTEGER PRIMARY KEY REFERENCES order_line_items(id) ON DELETE CASCADE,
  status         TEXT NOT NULL CHECK (status IN ('listed', 'not_listed', 'no_car', 'universal')),
  is_default_car BOOLEAN,
  generation_id  TEXT,
  year           INTEGER,
  version_id     TEXT,
  brand          TEXT, brand_ar   TEXT, brand_zh   TEXT,
  model          TEXT, model_ar   TEXT, model_zh   TEXT,
  version        TEXT, version_ar TEXT, version_zh TEXT,
  engine         TEXT, engine_ar  TEXT, engine_zh  TEXT,
  seats          INTEGER,
  photo_url      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
