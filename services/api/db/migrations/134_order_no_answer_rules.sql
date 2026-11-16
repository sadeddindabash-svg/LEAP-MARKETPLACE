-- What happens when a supplier does not answer a new order in 24 hours (confirmed with the person via mockup, option C: automatic, with the admin's rules).
CREATE TABLE IF NOT EXISTS order_no_answer_rules (
  id                      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),          -- one row: the shop's rules
  then_action             TEXT NOT NULL DEFAULT 'move' CHECK (then_action IN ('move', 'resend', 'ask')),
  pick_by                 TEXT NOT NULL DEFAULT 'price' CHECK (pick_by IN ('price', 'stock')),
  max_price_increase_pct  NUMERIC(5, 2) NOT NULL DEFAULT 10 CHECK (max_price_increase_pct >= 0 AND max_price_increase_pct <= 100),
  if_none                 TEXT NOT NULL DEFAULT 'resend' CHECK (if_none IN ('resend', 'ask')),
  max_resends             INTEGER NOT NULL DEFAULT 1 CHECK (max_resends >= 0 AND max_resends <= 5),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by              TEXT
);
INSERT INTO order_no_answer_rules (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- How many times an order was sent again to the same supplier, and when a part was closed because nobody answered (then given to another supplier).
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS resend_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS no_answer_closed_at TIMESTAMPTZ;

-- The order's history of these steps, shown to the admin: no answer, sent again, moved (automatically or by the admin), passed to the admin.
CREATE TABLE IF NOT EXISTS sub_order_events (
  id            SERIAL PRIMARY KEY,
  sub_order_id  INTEGER NOT NULL REFERENCES supplier_sub_orders(id) ON DELETE CASCADE,
  order_id      TEXT NOT NULL,
  kind          TEXT NOT NULL,
  detail        TEXT,
  by_admin      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sub_order_events_order ON sub_order_events(order_id, created_at);
