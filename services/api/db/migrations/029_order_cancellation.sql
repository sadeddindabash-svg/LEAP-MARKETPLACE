-- Migration 029: real order cancellation + real guest-to-account
-- conversion.
--
-- CONFIRMED SCOPE, discussed before building: a buyer can cancel their
-- own real order only while every real sub-order within it is still
-- 'pending' or 'preparing' -- the moment even one sub-order genuinely
-- ships, self-service cancellation is blocked and becomes a real
-- support conversation instead. Since real payment capture isn't built
-- yet, cancelling is purely a real status change right now -- there's
-- no real captured payment to refund.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('to_pay', 'to_ship', 'processing', 'shipped', 'to_review', 'delivered', 'dispute', 'returns', 'cancelled'));

ALTER TABLE supplier_sub_orders DROP CONSTRAINT IF EXISTS supplier_sub_orders_status_check;
ALTER TABLE supplier_sub_orders ADD CONSTRAINT supplier_sub_orders_status_check
  CHECK (status IN ('pending', 'preparing', 'shipped', 'delivered', 'dispute', 'cancelled'));
