-- The basket keeps its order (confirmed with the person): the basket was listed with no order at all, so changing a quantity rewrote that line
-- and the database could hand it back in another place (the card jumped down and another came up). Each line now remembers when it was put in
-- the basket, and the basket is listed in that order. Lines already in baskets get the same moment, so they keep a fixed order by product.
-- Changing a quantity does not touch added_at (the upsert only sets quantity).
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ NOT NULL DEFAULT now();
