-- Migration 013: shipping dimensions and weight
--
-- CONFIRMED BUSINESS DECISION: mandatory going forward for new supplier
-- submissions (enforced in application code, not a DB constraint — the
-- same pattern as "at least 3 photos" in migration 010 — so existing
-- already-live products aren't retroactively broken by a NOT NULL
-- constraint they were never asked to satisfy). These will feed a real
-- shipping-fee calculation in the admin dashboard later, which is
-- exactly why they're stored as real structured numbers, not free text
-- like "30x20x10cm, about 2kg" — a shipping formula needs actual
-- operable numbers.
--
-- Weight in kilograms, dimensions in centimeters — single canonical
-- units stored once; any unit conversion for display (e.g. lb/inches
-- for a US-based reviewer) is a presentation-layer concern, not a
-- storage concern.
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(8, 3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS length_cm NUMERIC(8, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS width_cm NUMERIC(8, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm NUMERIC(8, 2);
