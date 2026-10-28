-- A supplier answers a new order: ACCEPT or REFUSE (with a reason), within 24 hours. A reminder goes to the supplier every 4 hours; after 24 hours with no answer it goes to the admin; it is NEVER cancelled silently.
-- A refused order is a cancelled sub-order with the reason; the admin sees the refused (and overdue) ones in a list and can reassign the item to another supplier.
ALTER TABLE supplier_sub_orders
  ADD COLUMN IF NOT EXISTS respond_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refusal_reason TEXT,
  ADD COLUMN IF NOT EXISTS refusal_note TEXT,
  ADD COLUMN IF NOT EXISTS reminders_sent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refusal_handled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refusal_handled_by TEXT,
  ADD COLUMN IF NOT EXISTS refusal_handled_note TEXT,
  ADD COLUMN IF NOT EXISTS reassigned_to_sub_order_id INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_sub_orders_refusal_reason_check') THEN
    ALTER TABLE supplier_sub_orders ADD CONSTRAINT supplier_sub_orders_refusal_reason_check
      CHECK (refusal_reason IS NULL OR refusal_reason IN ('out_of_stock', 'price_changed', 'discontinued', 'cannot_ship_in_time', 'other'));
  END IF;
END $$;

-- The 24 hours start when the order is placed (the sub-order is created in the same moment): a new sub-order gets its deadline by default.
ALTER TABLE supplier_sub_orders ALTER COLUMN respond_by SET DEFAULT (now() + interval '24 hours');
-- Orders that are waiting for an answer right now get a fresh 24 hours from this moment (they were never asked before).
UPDATE supplier_sub_orders SET respond_by = now() + interval '24 hours' WHERE status = 'pending' AND respond_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_sub_orders_awaiting_answer ON supplier_sub_orders (respond_by) WHERE status = 'pending';
