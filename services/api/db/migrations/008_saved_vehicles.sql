-- Migration 008: saved vehicles ("My Garage", BUY-004/010-012)
--
-- Distinct from the `vehicles` table (added in migration 001), which is
-- reference data — every Year/Make/Model/Trim combination Leap knows
-- about, used for fitment matching. This table is per-buyer: which of
-- those reference vehicles a specific buyer has actually saved to their
-- garage. Confusing these two would be a real bug (a "garage" that shows
-- every vehicle in the system rather than just the buyer's own).

CREATE TABLE IF NOT EXISTS user_saved_vehicles (
  buyer_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id  TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, vehicle_id)
);
