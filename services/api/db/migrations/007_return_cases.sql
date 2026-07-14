-- Migration 007: return/dispute cases (BUY-053, SUP-030, ADM-011-ish)
--
-- IMPORTANT DESIGN DECISION: two SEPARATE message threads (buyer<->admin
-- and supplier<->admin), not one shared thread. This isn't just a UI
-- choice -- it's how the "no direct buyer<->supplier contact" business
-- rule (SRS Section 2.5, same rule enforced in the support_tickets and
-- order modules) gets enforced structurally at the data model level. If
-- there were one shared thread, a buyer and supplier could read each
-- other's messages even if no UI ever displayed them together -- the
-- data itself would make direct contact possible. Two separate tables
-- make that impossible regardless of what any future UI does.

CREATE TABLE IF NOT EXISTS return_cases (
  id            TEXT PRIMARY KEY, -- e.g. 'RC-3391'
  order_id      TEXT NOT NULL REFERENCES orders(id),
  sub_order_id  INTEGER NOT NULL REFERENCES supplier_sub_orders(id),
  buyer_id      TEXT REFERENCES users(id),
  guest_email   TEXT,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'awaiting'
                CHECK (status IN ('awaiting', 'in_progress', 'approved', 'rejected', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT return_case_buyer_or_guest CHECK (buyer_id IS NOT NULL OR guest_email IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_return_cases_status ON return_cases(status);
CREATE INDEX IF NOT EXISTS idx_return_cases_sub_order ON return_cases(sub_order_id);

-- Buyer <-> Platform thread. A supplier is never granted access to this table.
CREATE TABLE IF NOT EXISTS return_case_buyer_messages (
  id          SERIAL PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES return_cases(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('buyer', 'admin')),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supplier <-> Platform thread. A buyer is never granted access to this table.
CREATE TABLE IF NOT EXISTS return_case_supplier_messages (
  id          SERIAL PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES return_cases(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('supplier', 'admin')),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Starts at 3410, not 3400 — db/seed.js hardcodes return case ID RC-3400
-- directly (bypassing this sequence, for predictable seed data), so
-- starting the sequence at 3400 would collide with that on the very first
-- real case created (same bug pattern caught and fixed for ticket_id_seq
-- in migration 005 — applying the same fix proactively here).
CREATE SEQUENCE IF NOT EXISTS return_case_id_seq START WITH 3410 INCREMENT BY 1;
