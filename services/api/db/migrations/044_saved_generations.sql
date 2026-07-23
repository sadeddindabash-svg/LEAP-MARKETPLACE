-- Migration 044: fix My Garage's real dead-end.
--
-- REAL BUG FOUND AND FIXED HERE: user_saved_vehicles (migration 008)
-- references `vehicles`, the flat make/model/trim/yearsRange reference
-- table -- but NOTHING in this entire codebase ever writes a row into
-- `product_fitment` (the join table a saved vehicle would need to
-- match against real products). Confirmed directly by grep, not
-- assumed: every real product's fitment lives only in
-- product_fitment_entries, the structured Brand->Model->Generation
-- cascade a supplier actually submits against (migration 010) -- the
-- SAME system the search vehicle filter (services/api's "Brand/Model/
-- Generation(Year) filter for search" section) already uses correctly.
--
-- So My Garage's own "shop for my vehicle" promise has never actually
-- held: a saved vehicle could never filter the catalog to a real
-- product. This is a genuine, separate rebuild of the feature onto the
-- real, populated system -- not a column added to the old table.
-- user_saved_vehicles is left in place, untouched, rather than dropped
-- -- consistent with this project's non-destructive migration
-- philosophy, and in case any real historical data ever needs it.
CREATE TABLE IF NOT EXISTS user_saved_generations (
  buyer_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generation_id  TEXT NOT NULL REFERENCES vehicle_generations(id) ON DELETE CASCADE,
  year           INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, generation_id, year)
);
