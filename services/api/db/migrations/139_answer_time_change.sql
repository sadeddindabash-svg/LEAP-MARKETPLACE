-- Orders > Rules > step 1 (confirmed with the person via mockup): what a new answer time does to the orders already waiting.
--   on_longer          'all' (orders already waiting get the extra time too) | 'new' (only new orders)
--   on_shorter         'new' (orders waiting keep their deadline) | 'all' (they get less time too, but never less than shorter_min_hours from now)
--   tell_supplier_deadline   tell the supplier when its deadline changes
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS on_longer TEXT NOT NULL DEFAULT 'all';
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS on_shorter TEXT NOT NULL DEFAULT 'new';
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS shorter_min_hours INTEGER NOT NULL DEFAULT 2;
ALTER TABLE order_no_answer_rules ADD COLUMN IF NOT EXISTS tell_supplier_deadline BOOLEAN NOT NULL DEFAULT true;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_no_answer_rules_change_choices') THEN
    ALTER TABLE order_no_answer_rules ADD CONSTRAINT order_no_answer_rules_change_choices CHECK (on_longer IN ('all', 'new') AND on_shorter IN ('all', 'new') AND shorter_min_hours BETWEEN 1 AND 12);
  END IF;
END $$;
