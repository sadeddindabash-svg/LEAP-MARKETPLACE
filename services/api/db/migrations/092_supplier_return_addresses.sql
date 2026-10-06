-- Migration 092: where the inspection hub sends a faulty unit BACK to.
--
-- THE GAP: a confirmed real fault (migration 091) tells the hub to return the unit to the supplier, but nothing in
-- the system said WHERE: `suppliers` has only a name, a country and a contact email. Hub staff had no address to
-- ship to and no phone number for the courier.
--
-- Same shape as supplier_payout_methods (migration 034): ONE row per supplier, a PUT replaces whatever was there
-- (no history), written by the supplier in their own Settings or by an admin on the supplier's page.
--
-- The address is stored AS ENTERED, in whatever language the supplier's courier needs (a Chinese supplier will
-- normally write it in Chinese). It is shown to hub staff and printed on the return label; it is never sent to buyers.
CREATE TABLE supplier_return_addresses (
  supplier_id TEXT PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT REFERENCES users(id)
);
