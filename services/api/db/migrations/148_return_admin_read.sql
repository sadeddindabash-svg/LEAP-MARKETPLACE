-- Migration 148: a new message on a return is marked for the admin until someone opens the case (patch-returns-messages).
-- admin_read_at: the last time an admin opened the case; a supplier or buyer message after it is "new".
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ;
UPDATE return_cases SET admin_read_at = now() WHERE admin_read_at IS NULL;      -- messages from before this are not shown as new
