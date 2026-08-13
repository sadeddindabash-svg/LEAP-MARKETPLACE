-- Migration 056: real account deletion/anonymization (#147), real
-- bug report submissions (#139).
--
-- CONFIRMED SCOPE, account deletion: anonymizes rather than hard-
-- deletes -- a real hard delete would cascade-destroy real order,
-- payout, and support history that's often legally required to keep
-- for financial/audit purposes. deleted_at marks the real point in
-- time; email/name get scrubbed at deletion time in application code,
-- not here.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Real idempotency key (#60) -- lets a real offline-queued order
-- retry safely without creating a real duplicate order if an earlier
-- attempt actually succeeded server-side before the device lost
-- track of the real response (e.g. connectivity dropped right as the
-- real response was on its way back).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS bug_reports (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL, -- nullable: a real guest can report a bug too
  description  TEXT NOT NULL,
  screenshot_url TEXT,
  device_info  TEXT, -- real OS/app-version string, sent by the real device itself, not fabricated here
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
