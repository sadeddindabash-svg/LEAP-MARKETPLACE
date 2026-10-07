-- Migration 097: payment adjustments on a payout, for faults that LEAP bears the cost of.
--
-- A shipment that has a fault case also has a return case, and the payout rules never pay an order that has a return case. That is exactly right when
-- the SUPPLIER is at fault (they are paid once, for the unit the buyer finally receives, through the replacement). But when LEAP bears the cost (the
-- supplier shipped good goods and the fault happened in our care) Leap owes the supplier for the ORIGINAL order too, plus the supplier's local
-- shipping charges. Those are recorded here, explicitly, by an admin, and are picked up by the supplier's next payout like any other amount owed.
--
--   kind 'original_order'  the original order's value net of commission (amount) and before commission (gross_amount)
--   kind 'local_shipping'  the supplier's local shipping charges, typed by the admin (nothing stores them elsewhere); no commission (amount = gross_amount)
--
-- The replacement itself needs no adjustment: it becomes payable on delivery like any order (migration 095).
-- Anything else caused by a supplier's own fault is simply never paid to them: the platform does not charge it, it just does not pay it.
CREATE TABLE payout_adjustments (
  id SERIAL PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  fault_case_id INTEGER NOT NULL REFERENCES fault_cases(id),
  kind TEXT NOT NULL CHECK (kind IN ('original_order', 'local_shipping')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  gross_amount NUMERIC(12, 2) NOT NULL CHECK (gross_amount > 0),
  note TEXT,
  created_by_admin_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payout_id INTEGER REFERENCES payouts(id),
  UNIQUE (fault_case_id, kind)
);
CREATE INDEX payout_adjustments_unpaid_idx ON payout_adjustments (supplier_id) WHERE payout_id IS NULL;
