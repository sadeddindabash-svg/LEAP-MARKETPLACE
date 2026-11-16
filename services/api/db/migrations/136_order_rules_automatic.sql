-- Orders > Rules, fully automatic (confirmed with the person via mockup):
--   if_too_dear   when every other supplier costs more than the limit: 'cancel' (cancel and refund) | 'move_anyway' (to the cheapest)
--   refund_mode   'auto' (back to the card / PayPal by itself; a failure comes to the admin) | 'manual'
--   notify_mode   what the admin is told: 'each' (every step) | 'daily' (one summary a day) | 'failures' (only when something fails)
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS if_too_dear TEXT NOT NULL DEFAULT 'cancel';
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS refund_mode TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS notify_mode TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS last_summary_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_no_answer_rules_auto_choices') THEN
    ALTER TABLE order_no_answer_rules ADD CONSTRAINT order_no_answer_rules_auto_choices CHECK (if_too_dear IN ('cancel', 'move_anyway') AND refund_mode IN ('auto', 'manual') AND notify_mode IN ('each', 'daily', 'failures'));
  END IF;
END $$;

-- The refund of a part nobody could take: 'pending' (to do), 'auto_done', 'failed' (the automatic refund did not work: the admin does it), 'manual_done'.
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS refund_status TEXT;
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS refund_error TEXT;
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS refund_provider TEXT;
UPDATE supplier_sub_orders SET refund_status = CASE WHEN refund_issued_at IS NULL THEN 'pending' ELSE 'manual_done' END WHERE refund_needed_amount IS NOT NULL AND refund_status IS NULL;
