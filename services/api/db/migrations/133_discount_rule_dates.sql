-- Discount rules get a time window and a countdown choice (confirmed with the person via mockup: admin option C, product page option B).
--   starts_at: when the discount begins (NULL = straight away)
--   ends_at:   when it ends (NULL = no end, works as before)
--   countdown: when buyers see the countdown on the product page: 'last3' = only in the last 3 days, 'always', 'never'
-- A rule outside its window gives no discount anywhere (product page, cards, basket, checkout). Existing rules keep working as before.
ALTER TABLE discount_rules ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE discount_rules ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE discount_rules ADD COLUMN IF NOT EXISTS countdown TEXT NOT NULL DEFAULT 'last3';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discount_rules_countdown_check') THEN
    ALTER TABLE discount_rules ADD CONSTRAINT discount_rules_countdown_check CHECK (countdown IN ('last3', 'always', 'never'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discount_rules_window_check') THEN
    ALTER TABLE discount_rules ADD CONSTRAINT discount_rules_window_check CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at);
  END IF;
END $$;
