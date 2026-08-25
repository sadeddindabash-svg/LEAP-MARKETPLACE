-- Migration 069: adds a real Arabic name for a supplier's "ships
-- from" country, confirmed with the person directly: this is a real
-- buyer-facing signal (shipsFromCountry) shown in both languages, so
-- it needs a genuine admin-provided Arabic translation rather than
-- the mobile app's own previous, incomplete hardcoded lookup (which
-- only ever knew the Arabic name for exactly one country, 'China'),
-- and would have shown raw English text to Arabic buyers for any
-- other real country an admin sets now that this field is editable.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country_ar TEXT;
