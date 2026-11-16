-- Migration 149: who a return started with, and a conversation with the hub (patch-returns-conversations).
--   source          'buyer' = the buyer asked for the return; 'hub' = the hub found the problem at inspection
--   the supplier's conversation now also holds the opening message: the hub's report (sender 'hub') or the buyer's request (sender 'buyer');
--   the supplier's own replies still reach Leap only.
--   return_case_hub_messages: Leap <-> the hub that flagged the parcel. hub_read_at: the last time the hub opened it.
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'buyer';
ALTER TABLE return_cases DROP CONSTRAINT IF EXISTS return_cases_source_check;
ALTER TABLE return_cases ADD CONSTRAINT return_cases_source_check CHECK (source IN ('buyer', 'hub'));
UPDATE return_cases SET source = 'hub' WHERE reason = 'Quality issue flagged during hub inspection';
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS hub_read_at TIMESTAMPTZ;

ALTER TABLE return_case_supplier_messages DROP CONSTRAINT IF EXISTS return_case_supplier_messages_sender_role_check;
ALTER TABLE return_case_supplier_messages ADD CONSTRAINT return_case_supplier_messages_sender_role_check CHECK (sender_role IN ('supplier', 'admin', 'hub', 'buyer'));

CREATE TABLE IF NOT EXISTS return_case_hub_messages (
  id SERIAL PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES return_cases(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('hub', 'admin')),
  sender_id TEXT REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_return_case_hub_messages_case ON return_case_hub_messages(case_id, created_at);

-- the hub cases from before: their report opens the hub and supplier conversations, so nothing looks empty
INSERT INTO return_case_hub_messages (case_id, sender_role, message, created_at)
SELECT rc.id, 'hub', COALESCE(NULLIF(e.notes, ''), 'Problem found at inspection'), e.created_at
FROM return_cases rc
JOIN hub_shipments hs ON hs.sub_order_id = rc.sub_order_id
JOIN LATERAL (SELECT * FROM hub_shipment_events ev WHERE ev.shipment_id = hs.id AND ev.step = 'flagged' ORDER BY ev.created_at DESC LIMIT 1) e ON true
WHERE rc.source = 'hub' AND NOT EXISTS (SELECT 1 FROM return_case_hub_messages m WHERE m.case_id = rc.id);
UPDATE return_cases SET hub_read_at = now() WHERE source = 'hub' AND hub_read_at IS NULL;
