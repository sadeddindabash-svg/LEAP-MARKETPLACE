-- ONE CART PER ACCOUNT: a signed-in buyer's device carts are combined into one account cart. A cart that was combined into another keeps its id and points at the account cart (merged_into),
-- so a device that still sends the old id is sent to the account cart instead of getting an empty one.
ALTER TABLE carts ADD COLUMN IF NOT EXISTS merged_into TEXT REFERENCES carts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_carts_buyer_open ON carts (buyer_id, created_at) WHERE buyer_id IS NOT NULL AND merged_into IS NULL;
