-- Migration 038: real price-drop alerts on wishlist items.
--
-- CONFIRMED DESIGN: prices in this project are computed live (see
-- services/api/src/modules/pricing/engine.js), never stored -- so
-- detecting a real "drop" needs a real, periodically re-checked
-- snapshot to compare against, not a live-vs-live comparison (which
-- has nothing to compare to). `last_known_buyer_price_usd` is that
-- real snapshot -- deliberately nullable: NULL means this product has
-- never been checked yet, so the first real scheduled check for it
-- only RECORDS a real baseline rather than notifying anyone (there's
-- no real "before" price to have genuinely dropped from).
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_known_buyer_price_usd NUMERIC;

-- Real, confirmed addition to the notifications type constraint --
-- learned the hard way with migration 037's low_stock type that this
-- constraint needs updating every time a genuinely new notification
-- type is introduced, not just assumed to already allow it.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['order_status', 'return_status', 'ticket_reply', 'supplier_message', 'referral_reward', 'low_stock', 'price_drop']));

