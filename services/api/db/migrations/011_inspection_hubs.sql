-- Migration 011: regional inspection hubs (new business requirement --
-- every order now routes Supplier -> Hub -> Buyer, never supplier direct
-- to buyer).
--
-- FULFILLMENT NOW HAS TWO REAL LEGS, not one:
--   Leg 1 (existing, supplier_sub_orders.status): supplier packs and
--     ships to a HUB. 'shipped' here now means "shipped to the assigned
--     hub", NOT "shipped to the buyer" -- that meaning changed with this
--     migration. See the supplier module's updated comment.
--   Leg 2 (new, hub_shipments.status): the hub receives, opens,
--     inspects, packs, and ships to the actual buyer. This is the leg a
--     buyer's real tracking status should eventually reflect.
--
-- A supplier cannot mark a sub-order 'shipped' until an admin has
-- assigned a hub to it -- enforced in application code (see
-- supplier/routes.js), not just a UI nicety.

CREATE TABLE IF NOT EXISTS hubs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  region      TEXT NOT NULL, -- e.g. a country or broader region label
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Same pattern as supplier accounts (migration 006): a 'hub_staff' role
-- requires a hub_id, enforced at the DB level, not just in application code.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('buyer', 'admin', 'support', 'finance', 'supplier', 'hub_staff'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS hub_id TEXT REFERENCES hubs(id);
ALTER TABLE users ADD CONSTRAINT hub_staff_role_has_hub_id
  CHECK (role != 'hub_staff' OR hub_id IS NOT NULL);

-- Which hub a given supplier sub-order is routed to. NULL means "not yet
-- assigned" -- and a supplier cannot mark this sub-order 'shipped' while
-- it's NULL (see supplier/routes.js).
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS hub_id TEXT REFERENCES hubs(id);

-- The hub's own leg of the journey. One row per sub-order (a sub-order's
-- hub_shipment is created automatically the moment a supplier marks it
-- 'shipped' -- see supplier/routes.js) -- NOT one row per order, since a
-- multi-supplier order's sub-orders can be routed to different hubs
-- (or even reach their hub at different times).
CREATE TABLE IF NOT EXISTS hub_shipments (
  id            SERIAL PRIMARY KEY,
  sub_order_id  INTEGER NOT NULL UNIQUE REFERENCES supplier_sub_orders(id) ON DELETE CASCADE,
  hub_id        TEXT NOT NULL REFERENCES hubs(id),
  status        TEXT NOT NULL DEFAULT 'awaiting_receipt'
                CHECK (status IN ('awaiting_receipt', 'received', 'opened', 'inspected', 'packed', 'shipped_to_buyer', 'flagged')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_shipments_hub ON hub_shipments(hub_id);

-- One row per completed step -- the real audit trail. Who did it, when,
-- and any notes (e.g. an inspection finding, or why something was flagged).
CREATE TABLE IF NOT EXISTS hub_shipment_events (
  id                SERIAL PRIMARY KEY,
  shipment_id       INTEGER NOT NULL REFERENCES hub_shipments(id) ON DELETE CASCADE,
  step              TEXT NOT NULL CHECK (step IN ('received', 'opened', 'inspected', 'packed', 'shipped_to_buyer', 'flagged')),
  notes             TEXT,
  tracking_number   TEXT, -- only meaningful for the 'shipped_to_buyer' step
  performed_by      TEXT REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_shipment_events_shipment ON hub_shipment_events(shipment_id);

-- Mandatory evidence photos per step -- same "at least N, enforced in
-- application code" pattern as product_images (migration 010).
CREATE TABLE IF NOT EXISTS hub_shipment_photos (
  id          SERIAL PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES hub_shipment_events(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_hub_shipment_photos_event ON hub_shipment_photos(event_id);
