-- Migration 054: real account-anniversary loyalty milestones (#58).
--
-- CONFIRMED SCOPE: last_anniversary_notified_year defaults to NULL
-- (via COALESCE to 0 in the real check itself) -- every real existing
-- user is treated as "never yet notified for any year", exactly
-- matching reality, not assuming a fake prior notification history.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_anniversary_notified_year INTEGER;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['order_status', 'return_status', 'ticket_reply', 'supplier_message', 'referral_reward', 'low_stock', 'price_drop', 'saved_search_match', 'back_in_stock', 'account_anniversary']));
