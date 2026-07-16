-- Migration 021: real audience targeting for promo codes.
--
-- CONFIRMED SCOPE, discussed before building: 4 real segments, all
-- combinable (AND logic -- every condition set on a code must be true
-- for a buyer to be eligible), using data already real in this system
-- (no new tracking needed):
--   - New users -- never placed a real order before.
--   - High-value / loyal customers -- real lifetime spend >= a
--     threshold the admin sets.
--   - Frequent buyers -- real total order count >= a threshold.
--   - Win-back / inactive customers -- real days since their last
--     order >= a threshold (implies they have ordered before at all;
--     a brand new user hasn't "gone quiet", they never started).
--
-- All columns are nullable and default to NULL/false -- an existing
-- code with no targeting set is untouched, open to everyone, exactly
-- as it was before this migration. A code with ANY of these set
-- requires a real logged-in buyer to check eligibility against (a
-- guest checkout has no real order history to evaluate).
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS require_new_user BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_total_spend NUMERIC;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_order_count INTEGER;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_inactive_days INTEGER;
