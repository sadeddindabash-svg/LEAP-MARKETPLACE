-- Migration 019: real notifications.
--
-- CONFIRMED SCOPE: triggered by order changes and message/ticket
-- replies. Real, concrete trigger points wired into existing endpoints
-- (see the relevant modules' PATCH/POST handlers) rather than a vague
-- "whenever something happens" — each real trigger is named explicitly
-- below and in this migration's own comment for traceability:
--   1. A real sub-order status change to 'shipped' or 'delivered'
--      (services/api/src/modules/supplier/routes.js) -> notifies the
--      real buyer.
--   2. A real return case status change
--      (services/api/src/modules/returns/routes.js) -> notifies the
--      real buyer.
--   3. An admin's real reply to a buyer's support ticket
--      (services/api/src/modules/support/routes.js) -> notifies the
--      real buyer (skipped for a guest ticket -- no real account to
--      attach an in-app notification to).
--   4. An admin's real reply to a supplier message
--      (services/api/src/modules/supplier-messages/routes.js) ->
--      notifies the real supplier's linked user account.
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('order_status', 'return_status', 'ticket_reply', 'supplier_message')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  link_type   TEXT, -- 'order' | 'return_case' | 'ticket' | 'supplier_message' -- real, specific navigation target
  link_id     TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
