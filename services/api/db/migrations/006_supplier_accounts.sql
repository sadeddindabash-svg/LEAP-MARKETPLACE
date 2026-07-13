-- Migration 006: supplier accounts
-- Adds a 'supplier' role so supplier-portal staff can log in, and links
-- that user to which supplier business they represent. A supplier user
-- without a supplier_id would be a data-integrity bug, so it's enforced
-- at the database level, not just application code.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('buyer', 'admin', 'support', 'finance', 'supplier'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES suppliers(id);

ALTER TABLE users ADD CONSTRAINT supplier_role_has_supplier_id
  CHECK (role != 'supplier' OR supplier_id IS NOT NULL);
