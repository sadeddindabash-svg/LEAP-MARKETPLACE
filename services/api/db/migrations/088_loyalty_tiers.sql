-- Migration 088: real buyer loyalty tiers -- confirmed with the
-- person through several rounds of design: a spend-based tier system
-- (Bronze/Silver/Gold/Diamond and so on), fully admin-editable from
-- the Pricing page rather than any threshold or percentage hardcoded
-- in the app. Seeded with a real starting set of 4 tiers so the
-- feature works out of the box -- the person explicitly wants to set
-- their own real numbers via the admin UI, so these are a real,
-- editable starting point, not a claim of the actual final numbers.
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL UNIQUE,
  name_ar               TEXT,
  spend_threshold       NUMERIC(10, 2) NOT NULL,
  discount_percentage   NUMERIC(5, 2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage < 100),
  icon                  TEXT NOT NULL DEFAULT 'medal',
  color                 TEXT NOT NULL DEFAULT 'gray',
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO loyalty_tiers (name, name_ar, spend_threshold, discount_percentage, icon, color, sort_order) VALUES
  ('Bronze', 'برونزي', 0, 0, 'medal', 'gray', 0),
  ('Silver', 'فضي', 500, 3, 'medal', 'gray', 1),
  ('Gold', 'ذهبي', 1500, 6, 'award', 'amber', 2),
  ('Diamond', 'ماسي', 5000, 10, 'diamond', 'blue', 3)
ON CONFLICT (name) DO NOTHING;
