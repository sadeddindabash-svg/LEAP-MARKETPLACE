-- Migration 045: real back-in-stock alerts on wishlist items.
--
-- A real, confirmed gap: nothing notified a buyer when a wishlisted,
-- out-of-stock product came back. Mirrors migration 038's price-drop
-- alert pattern (same real wishlist_items table, same notification +
-- email mechanism) -- but DELIBERATELY NOT a periodic sweep like that
-- one needs: stock, unlike a live-computed buyer price, only ever
-- changes at one real, controllable point (a supplier's own
-- PATCH /supplier/me/products/:id), so this hooks in directly there
-- instead of polling on a timer. See
-- services/api/src/modules/restockAlerts/notify.js for that logic.
--
-- CONFIRMED SCOPE: only a genuine 0 -> positive transition counts as
-- "back in stock" -- raising stock from 3 to 10 is not a restock from
-- a buyer's perspective (it was never actually unavailable).

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['order_status', 'return_status', 'ticket_reply', 'supplier_message', 'referral_reward', 'low_stock', 'price_drop', 'saved_search_match', 'back_in_stock']));
