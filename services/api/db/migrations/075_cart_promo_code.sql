-- Migration 075: adds a real, persisted applied_promo_code column
-- directly on carts, confirmed with the person directly: an applied
-- promo code should survive the buyer leaving the checkout screen --
-- and confirmed explicitly that this must be fully persistent (even
-- across closing and reopening the app), not just in-memory session
-- state, since the real cart itself is already backed the same way.
--
-- ON DELETE SET NULL rather than restricting deletion -- an admin
-- deleting a promo code shouldn't be blocked by some real buyer
-- somewhere having it currently applied to their cart; the cart
-- simply loses the reference and the real code's own price effect
-- disappears the next time this cart is read (re-validated fresh on
-- every real read, not trusted as still valid forever once stored).

ALTER TABLE carts ADD COLUMN IF NOT EXISTS applied_promo_code TEXT REFERENCES promo_codes(code) ON DELETE SET NULL;
