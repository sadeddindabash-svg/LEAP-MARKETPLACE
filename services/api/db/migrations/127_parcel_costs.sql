-- Migration 127: what each parcel REALLY cost to ship, entered by the inspection hub before it ships the parcel to the buyer, and compared with the
-- shipping already inside the parts' prices (the pricing engine's shipping fee). Only Leap's admins ever see the amounts.
--
--   order_line_items.shipping_planned_usd   the shipping inside ONE unit's price when the order was placed (checkout keeps it from now on). NULL
--                                           for an older order: the comparison then works it out from today's Pricing (marked as an estimate).
--   hub_parcel_costs                        one per parcel (hub shipment): what the hub paid the carrier, in its own currency and in dollars at the
--                                           day's rate, the planned cost it was compared with, and the result:
--       result   equal   within +-2% of the planned cost
--                saved   cheaper (the difference is extra profit)
--                over    dearer: the hub must add a photo of the parcel with its size and weight written on it, and the parcel waits for an admin
--       state    cleared      may ship (equal or saved)
--                needs_photo  over, the parcel photo is not there yet
--                waiting      over, waiting for an admin
--                approved     over, an admin approved it: may ship, the difference is extra cost
--                sent_back    an admin asked the hub to enter it again
ALTER TABLE order_line_items ADD COLUMN IF NOT EXISTS shipping_planned_usd NUMERIC(12, 4);

CREATE TABLE IF NOT EXISTS hub_parcel_costs (
  id                SERIAL PRIMARY KEY,
  shipment_id       INTEGER NOT NULL UNIQUE REFERENCES hub_shipments(id) ON DELETE CASCADE,
  amount            NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency          TEXT NOT NULL,
  rate_to_usd       NUMERIC(20, 10) NOT NULL CHECK (rate_to_usd > 0),
  amount_usd        NUMERIC(12, 2) NOT NULL,
  planned_usd       NUMERIC(12, 2),
  planned_estimated BOOLEAN NOT NULL DEFAULT false,
  carrier           TEXT NOT NULL,
  receipt_photo     TEXT,
  parcel_photo      TEXT,
  result            TEXT NOT NULL CHECK (result IN ('equal', 'saved', 'over')),
  state             TEXT NOT NULL CHECK (state IN ('cleared', 'needs_photo', 'waiting', 'approved', 'sent_back')),
  entered_by        TEXT REFERENCES users(id),
  entered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by        TEXT REFERENCES users(id),
  decided_at        TIMESTAMPTZ,
  admin_note        TEXT
);
CREATE INDEX IF NOT EXISTS hub_parcel_costs_waiting_idx ON hub_parcel_costs (state) WHERE state IN ('needs_photo', 'waiting');
CREATE INDEX IF NOT EXISTS hub_parcel_costs_entered_idx ON hub_parcel_costs (entered_at);
