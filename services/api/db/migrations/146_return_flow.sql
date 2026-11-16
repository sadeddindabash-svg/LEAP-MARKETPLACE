-- Migration 146: the buyer's return, from approval to the money and the stock (patch-returns-flow).
--   reason_code    the buyer picks a reason from a list (website); NULL for older cases and for a reason typed in the app
--   send_back      the admin decides on approval: true = the buyer sends the part to return_hub_id (with the case id as the return code),
--                  false = the buyer keeps it (not worth shipping back)
--   refund_when    'now' = refund as soon as it is approved; 'on_receipt' = refund when the hub has received the part
--   refund_status  waiting_part (refund once the part arrives) / pending (to be refunded) / auto_done / manual_done / failed
--   received_*     the hub (or the admin) received the part; a part in good condition goes back to stock (restocked_qty)
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS reason_code TEXT;
ALTER TABLE return_cases DROP CONSTRAINT IF EXISTS return_cases_reason_code_check;
ALTER TABLE return_cases ADD CONSTRAINT return_cases_reason_code_check
  CHECK (reason_code IS NULL OR reason_code IN ('wrong_part', 'damaged', 'doesnt_fit', 'not_as_described', 'other'));

ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS decided_by TEXT REFERENCES users(id);
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS send_back BOOLEAN;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS return_hub_id TEXT REFERENCES hubs(id);
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS refund_when TEXT;
ALTER TABLE return_cases DROP CONSTRAINT IF EXISTS return_cases_refund_when_check;
ALTER TABLE return_cases ADD CONSTRAINT return_cases_refund_when_check CHECK (refund_when IS NULL OR refund_when IN ('now', 'on_receipt'));

ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2) CHECK (refund_amount IS NULL OR refund_amount >= 0);
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS refund_status TEXT;
ALTER TABLE return_cases DROP CONSTRAINT IF EXISTS return_cases_refund_status_check;
ALTER TABLE return_cases ADD CONSTRAINT return_cases_refund_status_check
  CHECK (refund_status IS NULL OR refund_status IN ('waiting_part', 'pending', 'auto_done', 'manual_done', 'failed'));
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS refund_reference TEXT;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS refund_provider TEXT;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS refund_error TEXT;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS refund_issued_at TIMESTAMPTZ;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS refunded_by TEXT REFERENCES users(id);

ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS received_by TEXT REFERENCES users(id);
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS received_condition TEXT;
ALTER TABLE return_cases DROP CONSTRAINT IF EXISTS return_cases_received_condition_check;
ALTER TABLE return_cases ADD CONSTRAINT return_cases_received_condition_check
  CHECK (received_condition IS NULL OR received_condition IN ('good', 'damaged'));
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS restocked_qty INTEGER;

CREATE INDEX IF NOT EXISTS idx_return_cases_hub_incoming ON return_cases(return_hub_id) WHERE send_back = true AND received_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_return_cases_created ON return_cases(created_at);
