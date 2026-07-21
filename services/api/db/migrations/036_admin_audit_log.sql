-- Migration 036: real audit log of admin actions.
--
-- CONFIRMED SCOPE: a genuinely useful, practical subset of sensitive,
-- state-changing admin actions -- not literally every single admin
-- endpoint (63 real admin-only endpoints exist; most are simple reads
-- with nothing real to audit). Logged here: supplier verification
-- decisions, review moderation and flag dismissal, payout recording,
-- promo code creation, admin account creation and permission changes,
-- category commission changes, return window changes, and FX rate
-- mode/manual rate changes -- the real actions with real financial,
-- trust, or access-control consequences.
--
-- `details` is a real JSONB blob rather than a fixed set of columns --
-- different real actions naturally carry different real context (a
-- payout has an amount, a permission change has a page list, a promo
-- code has its own terms), and forcing them into one rigid shape would
-- either lose real detail or need a wide table of mostly-null columns.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          SERIAL PRIMARY KEY,
  admin_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_id);
