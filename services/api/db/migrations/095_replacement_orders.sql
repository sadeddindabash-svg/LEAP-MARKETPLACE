-- Migration 095: replacement orders for a confirmed real fault (the next step after migration 091's refunds).
--
-- When a hub flags a faulty unit and the supplier says they can replace it, an admin confirms a REPLACEMENT. That creates a new order,
-- numbered from the order it replaces ("LP-200934-R1", then "-R2" ...), that flows through the normal pipeline: the supplier ships it to
-- the inspection hub, the hub receives / inspects / ships it, and it is delivered. The buyer pays NOTHING for it.
--
--   orders.replacement_of      the order the BUYER PAID for (the ROOT, even when a replacement is itself replaced): null for a normal order
--   orders.replacement_number  1 for "-R1", 2 for "-R2" ...; unique per root
--
-- MONEY: the replacement's lines carry the ORIGINAL unit prices (order total is 0 for the buyer; the buyer is simply not shown prices). The
-- faulty original always has a return case, so it can never be paid out; the replacement becomes payable when delivered. Net effect for a
-- supplier-fault case: the supplier is paid ONCE, for the unit the buyer finally received, and bears the faulty unit and every shipping cost.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS replacement_of TEXT REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS replacement_number INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS orders_replacement_number_unique ON orders (replacement_of, replacement_number) WHERE replacement_of IS NOT NULL;

-- the case: a new state while the replacement is on its way, a new outcome, and what it needs to remember
ALTER TABLE fault_cases DROP CONSTRAINT IF EXISTS fault_cases_status_check;
ALTER TABLE fault_cases ADD CONSTRAINT fault_cases_status_check
  CHECK (status = ANY (ARRAY['awaiting_supplier', 'awaiting_admin', 'refund_pending', 'replacement_pending', 'completed']));
ALTER TABLE fault_cases DROP CONSTRAINT IF EXISTS fault_cases_outcome_check;
ALTER TABLE fault_cases ADD CONSTRAINT fault_cases_outcome_check CHECK (outcome IS NULL OR outcome = ANY (ARRAY['refund', 'replacement']));
ALTER TABLE fault_cases
  ADD COLUMN IF NOT EXISTS replacement_order_id TEXT REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS replacement_confirmed_by TEXT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS replacement_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replacement_delivered_at TIMESTAMPTZ;

-- how the hub shipment is finally closed when the case ends in a replacement
ALTER TABLE hub_shipments DROP CONSTRAINT IF EXISTS hub_shipments_resolution_check;
ALTER TABLE hub_shipments ADD CONSTRAINT hub_shipments_resolution_check
  CHECK (resolution IS NULL OR resolution = ANY (ARRAY['continue_processing', 'return_to_supplier', 'discard', 'replacement_requested', 'fault_refund', 'fault_replacement']));
