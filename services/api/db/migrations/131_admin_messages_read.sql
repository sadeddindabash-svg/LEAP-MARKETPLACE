-- Migration 131: when an admin last opened each supplier's message thread, so the admin portal can show how many messages from suppliers are
-- still unread (the number beside "Supplier Messages" in the side menu).
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS admin_messages_read_at TIMESTAMPTZ;
