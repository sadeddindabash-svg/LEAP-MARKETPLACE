-- Migration 004: supplier contact info
-- Adds a contact email so the admin Suppliers page has something real to
-- show/verify against. Deliberately NOT adding rating/fulfillment-SLA
-- columns here -- those would require aggregating real review/fulfillment
-- history that doesn't exist yet (no reviews table, no delivery tracking
-- history), so faking those numbers would be worse than just not showing
-- them. Listings count is derived via a join against products at query
-- time instead of stored, since it's always correct that way.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_email TEXT;
