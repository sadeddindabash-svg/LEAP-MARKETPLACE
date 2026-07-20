-- Migration 032: real recently viewed products, synced to the real
-- buyer's account (not device-local) -- confirmed scope, discussed
-- before building.
--
-- One real row per buyer+product pair; a repeat real view of the same
-- product updates viewed_at rather than creating a duplicate row (a
-- real "move to the front of the list" behavior, not an ever-growing
-- history). Real logged-in buyers only -- a real guest has no account
-- for this to sync to.
CREATE TABLE IF NOT EXISTS recently_viewed_products (
  buyer_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_buyer_time ON recently_viewed_products(buyer_id, viewed_at DESC);
