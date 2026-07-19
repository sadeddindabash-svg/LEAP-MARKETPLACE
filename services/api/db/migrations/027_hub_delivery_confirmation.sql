-- Migration 027: correct delivery confirmation ownership -- the HUB's
-- own final leg to the buyer, not the supplier's domestic leg to the
-- hub.
--
-- REAL BUG FOUND AND FIXED HERE, found by the person directly: a
-- supplier in this real business ships LOCALLY within China, hub to
-- hub -- their own tracking number only ever covers the domestic
-- Supplier -> Hub leg (see migration 011's own header comment, which
-- already correctly established this two-leg design). The REAL final
-- leg that actually reaches the buyer -- Hub -> Buyer -- is the hub's
-- own shipment, with the hub's OWN tracking number (already collected
-- in hub_shipment_events.tracking_number for the 'shipped_to_buyer'
-- step, per that same migration).
--
-- Migrations 024/026 built real carrier tracking + delivery
-- confirmation entirely against supplier_sub_orders -- the WRONG real
-- tracking number and the wrong real owner. A supplier has no real
-- visibility into whether a buyer actually received anything; only a
-- hub (or the real carrier covering that final leg) does. This
-- migration moves that real ownership to where it actually belongs.

-- Adds the real 'delivered' status, reached only after 'shipped_to_buyer'.
ALTER TABLE hub_shipments DROP CONSTRAINT IF EXISTS hub_shipments_status_check;
ALTER TABLE hub_shipments ADD CONSTRAINT hub_shipments_status_check
  CHECK (status IN ('awaiting_receipt', 'received', 'opened', 'inspected', 'packed', 'shipped_to_buyer', 'delivered', 'flagged'));

-- Same real fields migration 026 added to supplier_sub_orders, moved to
-- where they actually belong -- the hub's own final leg.
ALTER TABLE hub_shipments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE hub_shipments ADD COLUMN IF NOT EXISTS delivery_confirmed_by TEXT CHECK (delivery_confirmed_by IN ('carrier', 'hub_manual'));
ALTER TABLE hub_shipments ADD COLUMN IF NOT EXISTS delivery_note TEXT;
ALTER TABLE hub_shipments ADD COLUMN IF NOT EXISTS carrier_code TEXT;

-- The real, previous (incorrect) columns on supplier_sub_orders are
-- deliberately left in place rather than dropped -- this is dev/test
-- data, not a real production cutover needing a careful backfill, and
-- leaving them avoids any risk to existing data or code still
-- mid-deploy. They are simply no longer read or written by any real
-- application code as of this migration -- see webhooks/routes.js,
-- hub/routes.js, payouts/routes.js, reviews/routes.js, and
-- returns/routes.js, all updated in the same real pass as this
-- migration.
