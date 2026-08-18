-- Migration 061: real, optional photo for vehicle models -- confirmed
-- with the person: kept optional (unlike brands' required photo),
-- since forcing this on every model immediately would be a real,
-- disruptive burden given how many real models exist per brand. The
-- real "Shopping for" card falls back to the brand's own photo, then
-- a plain generic icon, when a specific model has none yet.

ALTER TABLE vehicle_models ADD COLUMN IF NOT EXISTS photo_url TEXT;
