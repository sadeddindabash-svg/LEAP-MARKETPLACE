-- Cancelling an order (or one supplier's part) by the buyer or by the admin, and its refund (Orders > Cancelled).
-- Who cancelled, when and why are kept on the part. The refund uses the columns the refused-order flow already has
-- (refund_needed_amount, refund_status, refund_issued_at, refund_reference, refund_provider, refund_error).
-- A supplier's refusal keeps refused_at / refusal_reason; an order nobody answered keeps no_answer_closed_at.
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS cancelled_by TEXT;          -- 'buyer' | 'admin'
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS cancelled_by_admin TEXT;    -- the admin's user id

DO $$ BEGIN
  ALTER TABLE supplier_sub_orders ADD CONSTRAINT supplier_sub_orders_cancelled_by_choices CHECK (cancelled_by IS NULL OR cancelled_by IN ('buyer', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_sub_orders_cancelled ON supplier_sub_orders (cancelled_at) WHERE status = 'cancelled';
