-- Migration 039: real saved searches with notifications.
--
-- CONFIRMED SCOPE: available in both the mobile app and the web
-- storefront. A real, periodic scheduled check (matching migration
-- 038's price-drop alerts) -- there's no single real save point to
-- hook "a new product now matches this search" into the way stock
-- decrementing has one.
--
-- `last_seen_product_ids` is a real, deliberately robust design
-- choice over tracking a timestamp: a product can start matching a
-- saved search for reasons that have nothing to do with when it was
-- created (getting approved days after submission, a translation
-- completing, its category changing) -- comparing the real, current
-- full match SET against the real, previously-seen set correctly
-- catches every one of these, not just "created after last check".
CREATE TABLE IF NOT EXISTS saved_searches (
  id                    SERIAL PRIMARY KEY,
  buyer_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  search_term           TEXT,
  category              TEXT,
  label                 TEXT NOT NULL,
  last_seen_product_ids JSONB NOT NULL DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_saved_searches_buyer ON saved_searches(buyer_id);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['order_status', 'return_status', 'ticket_reply', 'supplier_message', 'referral_reward', 'low_stock', 'price_drop', 'saved_search_match']));
