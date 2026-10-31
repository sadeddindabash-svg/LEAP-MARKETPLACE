-- Migration 120: delivery DRIVERS from the local delivery partner, the BUYER'S CODE, and "couldn't deliver" attempts.
--
-- Builds on migration 096 (the courier's link / QR on the hub's label). From now on:
--   * only a signed-in partner driver can confirm a delivery (admin creates the accounts: Hubs page -> Delivery drivers);
--   * the driver must type the buyer's 4-digit code, which the buyer sees in the app / website once the parcel is on its way;
--     5 wrong codes lock the parcel for 15 minutes;
--   * each proof records who received the parcel and, when the phone allows it, where it was delivered;
--   * a driver who cannot deliver records why (not home, wrong address, refused, other); admin and (when useful) the buyer are told.
-- Photos sent before this migration stay as they are ("not verified").
CREATE TABLE delivery_drivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  company TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,   -- raised by a password reset: every older sign-in stops working
  disabled_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX delivery_drivers_phone_idx ON delivery_drivers (phone);

ALTER TABLE delivery_proof_links
  ADD COLUMN buyer_code TEXT,
  ADD COLUMN code_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN code_locked_until TIMESTAMPTZ;

ALTER TABLE delivery_proofs
  ADD COLUMN driver_id INTEGER REFERENCES delivery_drivers(id),
  ADD COLUMN received_by TEXT CHECK (received_by IN ('buyer', 'family', 'reception', 'door')),
  ADD COLUMN code_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN latitude DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION,
  ADD COLUMN location_accuracy_m DOUBLE PRECISION;

CREATE TABLE delivery_attempts (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER NOT NULL REFERENCES hub_shipments(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES delivery_drivers(id),
  reason TEXT NOT NULL CHECK (reason IN ('not_home', 'wrong_address', 'refused', 'other')),
  note TEXT,
  photo_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_accuracy_m DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX delivery_attempts_shipment_idx ON delivery_attempts (shipment_id);
