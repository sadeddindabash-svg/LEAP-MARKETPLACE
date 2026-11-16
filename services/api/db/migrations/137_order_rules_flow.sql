-- Orders > Rules as the flow of a pending order (confirmed with the person via mockup): new settings.
--   remind_every_hours  1 to 12 (was always 4)
--   on_refuse           when a supplier refuses: 'move' (to another supplier automatically, as for no answer) | 'ask' (the admin decides)
--   new_supplier_mode   the new supplier gets 'same' (the same answer time and steps) | 'once' (one try, then cancel and refund)
--   summary_hour / summary_tz   when the daily summary is sent, in the admin's own time zone
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS remind_every_hours INTEGER NOT NULL DEFAULT 4;
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS on_refuse TEXT NOT NULL DEFAULT 'move';
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS new_supplier_mode TEXT NOT NULL DEFAULT 'same';
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS summary_hour INTEGER NOT NULL DEFAULT 9;
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS summary_tz TEXT NOT NULL DEFAULT 'Asia/Riyadh';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_no_answer_rules_flow_choices') THEN
    ALTER TABLE order_no_answer_rules ADD CONSTRAINT order_no_answer_rules_flow_choices CHECK (remind_every_hours BETWEEN 1 AND 12 AND on_refuse IN ('move', 'ask') AND new_supplier_mode IN ('same', 'once') AND summary_hour BETWEEN 0 AND 23);
  END IF;
END $$;
-- A part given to a new supplier under "one try only": no sending back; if it is not answered in time it is cancelled and refunded.
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS final_try BOOLEAN NOT NULL DEFAULT false;
