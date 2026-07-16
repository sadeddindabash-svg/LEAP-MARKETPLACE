-- Migration 018: real wishlist (BUY account -- "Wishlist" was requested
-- alongside Addresses, Payment, Bonus/Gifts, Coupons; this is the
-- concrete, well-understood one built first).
--
-- Same simple many-to-many junction pattern as user_saved_vehicles
-- (migration 008) -- which of the real products a buyer has saved,
-- nothing more.
CREATE TABLE IF NOT EXISTS wishlist_items (
  buyer_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, product_id)
);
