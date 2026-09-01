-- Migration 076: adds checkout price locking, confirmed with the
-- person through several rounds of clarification: NOT tied to when
-- an item was added to the cart, but to when the buyer actually
-- enters checkout. A single, whole-basket lock (checkout_locked_at
-- on carts) starts a real 60-minute window the moment checkout
-- begins; every item's real price at that moment is snapshotted onto
-- its own cart_items row (locked_price), so a supplier price change
-- during this window has no real effect until the lock expires.
--
-- Explicitly confirmed: going back to the basket mid-countdown and
-- returning to checkout before it expires keeps the same real
-- countdown running (not reset) -- checkout_locked_at only changes
-- when a NEW lock genuinely starts (no lock existed, or the
-- previous one had already expired).

ALTER TABLE carts ADD COLUMN IF NOT EXISTS checkout_locked_at TIMESTAMPTZ;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS locked_price NUMERIC(12, 2);
