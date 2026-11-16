-- Delivery Rules > "How it works" (confirmed with the person via mockup): the settings around the rules list, one row.
-- The defaults keep today's behaviour exactly (Jordan when the country is unknown, 7 days when no rule fits, nothing added, every day counted).
CREATE TABLE IF NOT EXISTS delivery_settings (
  id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fallback_country_iso  TEXT NOT NULL DEFAULT 'JO',
  no_rule_action        TEXT NOT NULL DEFAULT 'days',
  fallback_days         INTEGER NOT NULL DEFAULT 7,
  prep_days             INTEGER NOT NULL DEFAULT 0,
  inspection_days       INTEGER NOT NULL DEFAULT 0,
  off_days              INTEGER[] NOT NULL DEFAULT '{}',
  show_mode             TEXT NOT NULL DEFAULT 'date',
  range_days            INTEGER NOT NULL DEFAULT 1,
  notify_mode           TEXT NOT NULL DEFAULT 'daily',
  summary_hour          INTEGER NOT NULL DEFAULT 9,
  summary_tz            TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  last_summary_at       TIMESTAMPTZ,
  last_problem_count    INTEGER NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            TEXT
);
INSERT INTO delivery_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_settings_choices') THEN
    ALTER TABLE delivery_settings ADD CONSTRAINT delivery_settings_choices CHECK (
      no_rule_action IN ('days', 'hide') AND fallback_days BETWEEN 1 AND 60 AND prep_days BETWEEN 0 AND 10 AND inspection_days BETWEEN 0 AND 10
      AND off_days <@ ARRAY[0,1,2,3,4,5,6] AND cardinality(off_days) <= 3 AND show_mode IN ('date', 'range') AND range_days BETWEEN 1 AND 5
      AND notify_mode IN ('each', 'daily', 'failures') AND summary_hour BETWEEN 0 AND 23);
  END IF;
END $$;
