-- Migration 048: real "supplier_verification" in-app notification type
-- (10th real trigger point -- see notifications/helpers.js's own
-- header comment for the full, current list). Closes a real,
-- significant gap: nothing at all previously notified a supplier
-- whether their application was verified or rejected -- no email, no
-- in-app notification, the whole flow relied on them manually
-- re-checking the supplier portal indefinitely.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['order_status', 'return_status', 'ticket_reply', 'supplier_message', 'referral_reward', 'low_stock', 'price_drop', 'saved_search_match', 'back_in_stock', 'supplier_verification']));
