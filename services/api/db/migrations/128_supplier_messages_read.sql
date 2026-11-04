-- Migration 128: when a supplier last opened Messages in the supplier portal, so the side menu can show how many messages from the Leap team
-- arrived since then (the number goes away when they open Messages). NULL: never opened, every message from Leap counts.
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS messages_read_at TIMESTAMPTZ;
