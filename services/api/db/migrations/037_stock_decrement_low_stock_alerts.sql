-- Migration 037: real stock decrementing, real oversell prevention,
-- and real, supplier-configurable low-stock alerts.
--
-- A REAL, SIGNIFICANT GAP WAS FOUND FIRST, raised directly by the
-- person before building the originally-requested low-stock alert
-- feature: product stock_quantity was NEVER actually decremented
-- anywhere in this whole project -- a real order could be placed
-- indefinitely without ever reducing what a supplier's real available
-- stock showed, and nothing prevented a real order from genuinely
-- overselling past it. A low-stock alert is meaningless without real
-- stock tracking underneath it, so this migration and the real
-- POST /order changes alongside it fix that first.
--
-- CONFIRMED SCOPE for the alert itself: a real, supplier-configurable
-- threshold per product (not one fixed global number) -- a supplier
-- selling a slow-moving, expensive part may want a real alert at 2
-- units left; one selling a fast-moving, cheap one may want it at 20.
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;

-- REAL BUG FOUND AND FIXED HERE, via actual testing: the real
-- notifications table's own CHECK constraint (migration 019) only
-- ever allowed a fixed, specific set of real notification types --
-- 'low_stock' wasn't among them, so the real notification attempt
-- above genuinely failed with a real constraint violation the first
-- time this was tested end-to-end, not just assumed to work.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['order_status', 'return_status', 'ticket_reply', 'supplier_message', 'referral_reward', 'low_stock']));

