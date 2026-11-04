-- Migration 130: the evidence photos a hub adds for the step it is doing, kept on the server until the step is confirmed, so the hub portal and
-- the hub app show the same photos (a photo taken on the phone appears on the portal, and the other way round). `purpose`: which form they are for:
--   step          the next step (received, opened, inspected, packed, shipped to buyer)
--   flag          a quality issue being flagged
--   fault_return  a faulty unit sent back to the supplier or discarded
-- Cleared when the hub confirms a step (the photos then belong to that step's event).
CREATE TABLE IF NOT EXISTS hub_draft_photos (
  id          SERIAL PRIMARY KEY,
  shipment_id INTEGER NOT NULL REFERENCES hub_shipments(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('step', 'flag', 'fault_return')),
  url         TEXT NOT NULL,
  added_by    TEXT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, purpose, url)
);
