-- Migration 058: real state/province field on addresses.
--
-- CONFIRMED SCOPE: nullable -- not every real country has a
-- meaningful state/province subdivision, and CSCPickerPlus itself
-- only shows a real state dropdown when the selected country
-- actually has real states in its own bundled data.
ALTER TABLE buyer_addresses ADD COLUMN IF NOT EXISTS state TEXT;
