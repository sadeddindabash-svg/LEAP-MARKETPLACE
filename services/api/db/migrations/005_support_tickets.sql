-- Migration 005: support tickets
-- BUY-060/061 (buyer <-> Platform support, logged and linked to the
-- relevant order) and ADM-012 (admin views/responds to tickets).
--
-- Deliberately no buyer<->supplier messaging path exists anywhere in this
-- schema -- that's an explicit business requirement (SRS Section 2.5),
-- not an oversight. Every message here is either from a buyer/guest or
-- from platform staff ('admin').

CREATE TABLE IF NOT EXISTS support_tickets (
  id            TEXT PRIMARY KEY, -- e.g. 'T-5521'
  buyer_id      TEXT REFERENCES users(id),
  guest_email   TEXT, -- set instead of buyer_id if raised without an account
  order_id      TEXT REFERENCES orders(id), -- optional; a ticket need not be order-specific
  subject       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_buyer_or_guest CHECK (buyer_id IS NOT NULL OR guest_email IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_order ON support_tickets(order_id);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id          SERIAL PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('buyer', 'admin')),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id);

-- Starts at 5510, not 5500 — db/seed.js hardcodes ticket IDs T-5500 and
-- T-5501 directly (bypassing this sequence, to get predictable seed data),
-- so starting the sequence at 5500 would collide with those on the very
-- first real ticket created. Leaves room 5502-5509 for a few more
-- hardcoded seed tickets later without needing to touch this again.
CREATE SEQUENCE IF NOT EXISTS ticket_id_seq START WITH 5510 INCREMENT BY 1;
