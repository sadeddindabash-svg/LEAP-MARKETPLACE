-- Migration 096: delivery proof photos from the COURIER, through a link / QR printed on the parcel's label.
--
-- The hub prints an address label with a QR code. When the courier delivers, they scan it, take a photo and send it; that both stores the photo as
-- PROOF OF DELIVERY and marks the shipment DELIVERED (the same as the hub confirming it by hand, or the carrier's tracking saying so).
--
-- The QR is on the parcel, so the buyer (and anyone handling it) can see it. That is why the link is guarded: it is a long random token, it only
-- works once the hub has SHIPPED the parcel, it expires, the number of photos is capped, every upload records when and from where, and the
-- admin sees these photos labelled as "from the courier link, unverified".
CREATE TABLE delivery_proof_links (
  shipment_id INTEGER PRIMARY KEY REFERENCES hub_shipments(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE delivery_proofs (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER NOT NULL REFERENCES hub_shipments(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  courier_name TEXT,
  note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_ip TEXT,
  user_agent TEXT,
  -- true for the upload that actually turned the shipment into "delivered" (later uploads only add photos)
  marked_delivered BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX delivery_proofs_shipment_idx ON delivery_proofs (shipment_id);

-- a shipment can now also be confirmed delivered by the courier's link
ALTER TABLE hub_shipments DROP CONSTRAINT IF EXISTS hub_shipments_delivery_confirmed_by_check;
ALTER TABLE hub_shipments ADD CONSTRAINT hub_shipments_delivery_confirmed_by_check
  CHECK (delivery_confirmed_by = ANY (ARRAY['carrier', 'hub_manual', 'courier_link']));
