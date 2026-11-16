-- Pricing > Discount rules > Rules: how a discount price is held in the basket and at checkout (confirmed with the person via mockup).
CREATE TABLE IF NOT EXISTS discount_hold_rules (
  id                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tell_discount_end   BOOLEAN NOT NULL DEFAULT true,    -- step 1: tell the buyer when the discount on a basket part ends
  remind_before       BOOLEAN NOT NULL DEFAULT false,   -- step 1: remind the buyer before it ends
  remind_hours        INTEGER NOT NULL DEFAULT 3,
  hold_minutes        INTEGER NOT NULL DEFAULT 60,      -- step 2: how long checkout holds the prices
  tell_hold_start     BOOLEAN NOT NULL DEFAULT false,
  add_while_on        TEXT NOT NULL DEFAULT 'join',     -- step 3: the same part added while the discount is still on: 'join' the held line | 'new' line
  tell_new_line       BOOLEAN NOT NULL DEFAULT true,
  on_drop             TEXT NOT NULL DEFAULT 'lower',    -- step 4: a held part whose live price drops: 'lower' | 'keep'
  tell_drop           BOOLEAN NOT NULL DEFAULT true,
  tell_hold_end       BOOLEAN NOT NULL DEFAULT true,    -- step 5
  max_holds_per_day   INTEGER NOT NULL DEFAULT -1,      -- step 5: -1 = no limit, 0 to 3
  tell_order_saving   BOOLEAN NOT NULL DEFAULT true,    -- step 6: "your price hold saved you $X"
  notify_mode         TEXT NOT NULL DEFAULT 'daily',    -- step 7: 'each' | 'daily' | 'failures'
  summary_hour        INTEGER NOT NULL DEFAULT 9,
  summary_tz          TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  last_summary_at     TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          TEXT
);
INSERT INTO discount_hold_rules (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discount_hold_rules_choices') THEN
    ALTER TABLE discount_hold_rules ADD CONSTRAINT discount_hold_rules_choices CHECK (
      remind_hours BETWEEN 1 AND 24 AND hold_minutes BETWEEN 15 AND 180 AND add_while_on IN ('join', 'new') AND on_drop IN ('lower', 'keep')
      AND max_holds_per_day BETWEEN -1 AND 3 AND notify_mode IN ('each', 'daily', 'failures') AND summary_hour BETWEEN 0 AND 23);
  END IF;
END $$;

-- A basket line during a hold: held_quantity units at locked_price (the price when checkout was opened); the other units are a second
-- line at extra_locked_price (the price when they were added during the hold). Outside a hold both are ignored: one line at the live price.
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS held_quantity INTEGER;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS extra_locked_price NUMERIC(12,2);
-- what the scheduled check last saw, so the buyer is told once: the discount ended / it ends soon / the price dropped during the hold
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS discount_seen_pct NUMERIC(5,2);
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS reminded_for_end TIMESTAMPTZ;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS drop_told_at TIMESTAMPTZ;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS holds_day DATE;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS holds_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS hold_end_told_at TIMESTAMPTZ;

-- Every automatic step, for the Rules page's "What happened" list.
CREATE TABLE IF NOT EXISTS discount_hold_events (
  id          BIGSERIAL PRIMARY KEY,
  cart_id     TEXT,
  product_id  TEXT,
  order_id    TEXT,
  kind        TEXT NOT NULL,      -- hold_started | hold_limit | new_line | joined_hold | lowered | hold_ended | discount_ended | reminded | order_saved | order_mismatch
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discount_hold_events_created ON discount_hold_events (created_at DESC);
