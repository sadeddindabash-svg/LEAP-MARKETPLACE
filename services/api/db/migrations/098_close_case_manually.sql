-- Migration 098: an admin can CLOSE a fault case by hand (with a written reason), for the cases that get stuck: the hub never confirms the unit's
-- return, a replacement was cancelled by agreement, a case was opened twice. Who closed it and why is kept; the flag leaves the hub queue like any closed case.
ALTER TABLE fault_cases
  ADD COLUMN IF NOT EXISTS closed_manually_by TEXT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS closed_manually_note TEXT;

ALTER TABLE hub_shipments DROP CONSTRAINT IF EXISTS hub_shipments_resolution_check;
ALTER TABLE hub_shipments ADD CONSTRAINT hub_shipments_resolution_check
  CHECK (resolution IS NULL OR resolution = ANY (ARRAY['continue_processing', 'return_to_supplier', 'discard', 'replacement_requested', 'fault_refund', 'fault_replacement', 'fault_closed_manually']));
