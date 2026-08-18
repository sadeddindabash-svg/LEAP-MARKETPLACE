-- Migration 062: real, optional Arabic name for vehicle models --
-- confirmed with the person: kept optional (unlike brands' required
-- name_ar), since models already exist today without this field,
-- and making it required now would leave every existing model
-- failing validation until someone went back and filled it in.

ALTER TABLE vehicle_models ADD COLUMN IF NOT EXISTS name_ar TEXT;
