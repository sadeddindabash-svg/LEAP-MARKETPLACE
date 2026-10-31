-- Admin > Products > Delete: a product that a buyer is no longer waiting for can be deleted. One with history (finished orders, quote
-- requests...) stays in the database marked deleted, so its old orders keep it; it is gone from the shop, both portals' lists, carts,
-- wishlists and recently viewed, and opening it says "This product is no longer available". One with no history is removed completely.
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS products_deleted_idx ON products (deleted_at) WHERE deleted_at IS NOT NULL;
