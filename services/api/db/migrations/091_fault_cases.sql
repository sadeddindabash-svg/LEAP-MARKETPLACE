-- Migration 091: fault cases -- what happens after an admin confirms a flagged shipment is REALLY faulty.
--
-- THE MODEL (decided with the platform owner):
--   A flag from the hub has two possible verdicts.
--     1. "No fault" (the hub entered wrong data): the shipment simply resumes. Already built (migration 090).
--     2. "Real fault": a fault_case is opened. The hub is told to send the unit back to the supplier (or
--        discard it), the SUPPLIER is asked whether they can replace it, and once they answer the admin
--        confirms replace or refund. A refund is only RECORDED here -- the admin refunds manually in
--        Stripe/PayPal and marks it issued with a reference (no refund API is integrated yet).
--
-- This migration is the first of three patches: it carries the decision, the supplier's answer, the hub
-- return and the refund record. Creating the replacement order comes in the next one (the `outcome` and
-- `status` checks below are widened then).
--
-- A case belongs to ONE flagged shipment (UNIQUE shipment_id) and covers chosen ITEMS of that shipment, so a
-- 3-item order with one faulty item doesn't replace or refund all three.

-- ---- two new hub steps/statuses: the unit physically leaves the hub ----
ALTER TABLE hub_shipment_events DROP CONSTRAINT hub_shipment_events_step_check;
ALTER TABLE hub_shipment_events ADD CONSTRAINT hub_shipment_events_step_check
  CHECK (step = ANY (ARRAY['received', 'opened', 'inspected', 'packed', 'shipped_to_buyer', 'flagged', 'returned_to_supplier', 'discarded_at_hub']));

ALTER TABLE hub_shipments DROP CONSTRAINT hub_shipments_status_check;
ALTER TABLE hub_shipments ADD CONSTRAINT hub_shipments_status_check
  CHECK (status = ANY (ARRAY['awaiting_receipt', 'received', 'opened', 'inspected', 'packed', 'shipped_to_buyer', 'delivered', 'flagged', 'returned_to_supplier', 'discarded_at_hub']));

-- a completed refund case closes the flag with its own resolution value
ALTER TABLE hub_shipments DROP CONSTRAINT hub_shipments_resolution_check;
ALTER TABLE hub_shipments ADD CONSTRAINT hub_shipments_resolution_check
  CHECK (resolution IS NULL OR resolution = ANY (ARRAY['continue_processing', 'return_to_supplier', 'discard', 'replacement_requested', 'fault_refund']));

-- ---- the fault case ----
CREATE TABLE fault_cases (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER NOT NULL UNIQUE REFERENCES hub_shipments(id),
  sub_order_id INTEGER NOT NULL REFERENCES supplier_sub_orders(id),
  -- awaiting_supplier : the supplier has been asked "can you replace?" and hasn't answered
  -- awaiting_admin    : the supplier answered; the admin must confirm replace or refund
  -- refund_pending    : the admin confirmed a refund; it has not been marked issued yet
  -- completed         : the refund is issued AND the hub has returned/discarded the unit
  status TEXT NOT NULL DEFAULT 'awaiting_supplier'
    CHECK (status = ANY (ARRAY['awaiting_supplier', 'awaiting_admin', 'refund_pending', 'completed'])),
  -- who bears the cost of the fault (refund + return shipping): chosen per case by the admin.
  -- Recorded and shown only -- nothing is deducted from a supplier's payout automatically.
  cost_bearer TEXT NOT NULL CHECK (cost_bearer = ANY (ARRAY['supplier', 'leap'])),
  admin_notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- the supplier's answer to "can you replace?"
  supplier_can_replace BOOLEAN,
  supplier_eta DATE,
  supplier_note TEXT,
  supplier_answered_at TIMESTAMPTZ,
  supplier_answered_by TEXT REFERENCES users(id),

  -- the admin's confirmed outcome
  outcome TEXT CHECK (outcome IS NULL OR outcome = ANY (ARRAY['refund'])),
  refund_amount NUMERIC(12, 2) CHECK (refund_amount IS NULL OR refund_amount >= 0),
  refund_status TEXT CHECK (refund_status IS NULL OR refund_status = ANY (ARRAY['pending', 'issued'])),
  refund_reference TEXT,
  refund_confirmed_by TEXT REFERENCES users(id),
  refunded_at TIMESTAMPTZ,
  refunded_by TEXT REFERENCES users(id),

  -- the hub's physical handling of the faulty unit
  hub_return TEXT CHECK (hub_return IS NULL OR hub_return = ANY (ARRAY['returned', 'discarded'])),
  hub_returned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- which items of the shipment are faulty (a snapshot of the price the buyer paid, for the default refund)
CREATE TABLE fault_case_items (
  fault_case_id INTEGER NOT NULL REFERENCES fault_cases(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL,
  PRIMARY KEY (fault_case_id, product_id)
);

CREATE INDEX fault_cases_sub_order_idx ON fault_cases (sub_order_id);
CREATE INDEX fault_cases_status_idx ON fault_cases (status);
