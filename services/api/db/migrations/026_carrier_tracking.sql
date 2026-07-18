-- Migration 026: real carrier tracking integration (17TRACK).
--
-- CONFIRMED SCOPE, discussed and refined before building: real carrier
-- confirmation (via 17TRACK's webhook) is the preferred, trusted path
-- to "delivered" -- but the supplier's own manual confirmation stays as
-- a real fallback, since cross-border tracking data is often
-- incomplete or delayed and a carrier-only requirement would leave a
-- genuinely delivered order stuck with no way to release payment.
-- CONFIRMED: a manual override must be visibly distinguishable from a
-- real carrier-confirmed delivery, so a pattern of one supplier relying
-- on manual confirmation far more than others is actually visible to
-- an admin, not silently indistinguishable.

-- Which real carrier is handling this shipment -- needed to route (or
-- at least record) which carrier account 17TRACK itself resolved this
-- tracking number to.
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS carrier_code TEXT;

-- Real, honest provenance for HOW a sub-order reached 'delivered' --
-- 'carrier' (17TRACK's webhook confirmed it independently) or
-- 'supplier_manual' (the supplier's own claim, a real fallback). NULL
-- for any sub-order not yet delivered.
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS delivery_confirmed_by TEXT CHECK (delivery_confirmed_by IN ('carrier', 'supplier_manual'));

-- CONFIRMED: a manual override is a deliberate action, not a casual
-- one -- requires a real short note from the supplier explaining why
-- (e.g. "tracking never updated, buyer confirmed by chat"), visible to
-- an admin reviewing delivery-confirmation patterns.
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS delivery_note TEXT;
