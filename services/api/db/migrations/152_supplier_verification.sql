-- Migration 152: what a supplier sends so Leap can trust it is a real shop or warehouse (patch-supplier-verification):
-- the business license (photo, registration / credit code, legal representative), photos of the premises (outside with the sign, inside),
-- the location (address and map pin), a contact person, and business details. Leap's checklist and private notes on them.
CREATE TABLE IF NOT EXISTS supplier_verification (
  supplier_id TEXT PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
  premises_type TEXT CHECK (premises_type IN ('shop', 'warehouse', 'both')),
  license_photo_url TEXT,
  credit_code TEXT,
  legal_rep_name TEXT,
  address_text TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  contact_name TEXT,
  contact_role TEXT,
  contact_phone TEXT,
  year_founded INT,
  staff_count INT,
  warehouse_size_m2 INT,
  main_brands TEXT,
  main_categories TEXT,
  admin_notes TEXT,
  admin_notes_updated_at TIMESTAMPTZ,
  admin_notes_updated_by TEXT,
  submitted_at TIMESTAMPTZ,            -- the first time every required item was there (Leap is told once)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_verification_photos (
  id SERIAL PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('outside', 'inside')),
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_verification_photos_supplier ON supplier_verification_photos (supplier_id, kind, sort_order);

-- one row per item Leap has checked (no row = not checked yet)
CREATE TABLE IF NOT EXISTS supplier_verification_checks (
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  checked_by TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, item)
);
