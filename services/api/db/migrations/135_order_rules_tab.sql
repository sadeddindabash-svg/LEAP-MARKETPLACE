-- Orders > Rules (confirmed with the person via mockup): the wait is set in hours (1 to 72), the supplier can be sent the order again 0 to 3 times,
-- the new supplier may be at most 1 to 15 % dearer, and when nobody can take the part it is cancelled and the buyer refunded.
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS wait_hours INTEGER NOT NULL DEFAULT 24;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_no_answer_rules_wait_hours_range') THEN
    ALTER TABLE order_no_answer_rules ADD CONSTRAINT order_no_answer_rules_wait_hours_range CHECK (wait_hours BETWEEN 1 AND 72);
  END IF;
END $$;
UPDATE order_no_answer_rules SET max_resends = LEAST(max_resends, 3), max_price_increase_pct = LEAST(GREATEST(max_price_increase_pct, 1), 15) WHERE id = 1;

-- A part cancelled because no supplier could take it: the refund still to do by hand, and when it was done.
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS refund_needed_amount NUMERIC(12, 2);
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS refund_issued_at TIMESTAMPTZ;
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS refund_reference TEXT;

-- A new supplier part gets the wait from the rules (it was always 24 hours).
CREATE OR REPLACE FUNCTION set_sub_order_respond_by() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    NEW.respond_by := now() + make_interval(hours => COALESCE((SELECT wait_hours FROM order_no_answer_rules WHERE id = 1), 24));
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sub_order_respond_by ON supplier_sub_orders;
CREATE TRIGGER trg_sub_order_respond_by BEFORE INSERT ON supplier_sub_orders FOR EACH ROW EXECUTE FUNCTION set_sub_order_respond_by();
