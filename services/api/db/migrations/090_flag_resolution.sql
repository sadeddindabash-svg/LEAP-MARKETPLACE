-- Migration 090: resolving a flagged hub shipment.
--
-- THE GAP: when hub staff flag a shipment, a return case is opened automatically and an admin can work
-- that case (messages, statuses, buyer notifications). But the hub SHIPMENT itself stayed 'flagged'
-- forever, whatever the admin decided -- so a false alarm blocked the order for good (it could never be
-- delivered, so the supplier could never be paid), the admin's Flagged Shipments queue never shrank, and
-- the hub's workload kept counting handled shipments.
--
-- `resolution` records the admin's decision (and who/when/why). For 'continue_processing' the shipment's
-- status is also put back to the last real step, so the hub carries on. For the three terminal outcomes
-- the shipment deliberately STAYS at 'flagged' (an honest record of where it stopped) and `resolved_at`
-- is what removes it from the queue and from the hub's workload.
--
-- `damage_type` (optional) lets hub staff say what kind of problem they are flagging, instead of only
-- free text. Nullable: a flag isn't always damage, and older flags have none.
ALTER TABLE hub_shipment_events ADD COLUMN IF NOT EXISTS damage_type TEXT;
ALTER TABLE hub_shipment_events ADD CONSTRAINT hub_shipment_events_damage_type_check
  CHECK (damage_type IS NULL OR damage_type = ANY (ARRAY['physical_damage', 'water_damage', 'missing_parts', 'wrong_item', 'other']));

ALTER TABLE hub_shipments ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE hub_shipments ADD CONSTRAINT hub_shipments_resolution_check
  CHECK (resolution IS NULL OR resolution = ANY (ARRAY['continue_processing', 'return_to_supplier', 'discard', 'replacement_requested']));
ALTER TABLE hub_shipments ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE hub_shipments ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE hub_shipments ADD COLUMN IF NOT EXISTS resolved_by TEXT REFERENCES users(id);
