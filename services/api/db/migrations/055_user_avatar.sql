-- Migration 055: real profile avatar photo (new profile-photo
-- feature), real delay-notification dedup (#57).
--
-- CONFIRMED SCOPE: nullable, every real existing user simply has no
-- real avatar yet -- the mobile app's own real fallback (an initial-
-- letter circle) already covers this correctly with no further
-- change needed there.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Real dedup for the scheduled delay check (#57) -- prevents
-- re-notifying the same real buyer every single tick while a real
-- sub-order stays delayed, rather than exactly once when the delay is
-- first genuinely detected.
ALTER TABLE supplier_sub_orders ADD COLUMN IF NOT EXISTS delay_notified BOOLEAN NOT NULL DEFAULT false;
