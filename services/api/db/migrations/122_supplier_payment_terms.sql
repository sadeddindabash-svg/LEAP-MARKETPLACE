-- Migration 122: each verified supplier gets its own PAYMENT TERMS -- when an order becomes money Leap owes the supplier:
--   before_shipping       owed when the supplier accepts the order
--   hub_arrival           owed when the inspection hub marks the parcel received
--   after_delivery        owed when the parcel is delivered to the buyer
--   after_return_window   owed when the platform's return window has passed after delivery (the rule until now, and the default)
--   days_after_shipping   owed payment_term_days (1-30) days after the supplier ships to the hub
--
-- An order that is cancelled, refused or returned AFTER it was paid is money "to recover": it is taken off the supplier's next payout and
-- recorded here, so it is recovered only once.
ALTER TABLE suppliers
  ADD COLUMN payment_term TEXT NOT NULL DEFAULT 'after_return_window'
    CHECK (payment_term IN ('before_shipping', 'hub_arrival', 'after_delivery', 'after_return_window', 'days_after_shipping')),
  ADD COLUMN payment_term_days INTEGER CHECK (payment_term_days BETWEEN 1 AND 30),
  ADD CONSTRAINT suppliers_payment_term_days_needed CHECK ((payment_term = 'days_after_shipping') = (payment_term_days IS NOT NULL));

CREATE TABLE supplier_recoveries (
  sub_order_id INTEGER PRIMARY KEY REFERENCES supplier_sub_orders(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  payout_id INTEGER NOT NULL REFERENCES payouts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX supplier_recoveries_payout_idx ON supplier_recoveries (payout_id);
