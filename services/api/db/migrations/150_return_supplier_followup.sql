-- Migration 150: following up with the supplier on a return, and who pays when Leap approves (patch-returns-supplier-followup).
--   supplier_asked_at / supplier_ask_count  when Leap last asked the supplier to answer (the return itself, or "ask again" after a refusal)
--   supplier_reminded_at                     a reminder went out because the supplier had not answered 48 hours after being asked
--   cost_bearer                              'supplier' = the supplier is not paid for the part (default); 'leap' = Leap pays, the supplier is paid as usual
--   overrule_reason                          why Leap approved although the supplier did not accept (sent to the supplier)
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS supplier_asked_at TIMESTAMPTZ;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS supplier_ask_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS supplier_reminded_at TIMESTAMPTZ;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS cost_bearer TEXT;
ALTER TABLE return_cases DROP CONSTRAINT IF EXISTS return_cases_cost_bearer_check;
ALTER TABLE return_cases ADD CONSTRAINT return_cases_cost_bearer_check CHECK (cost_bearer IS NULL OR cost_bearer IN ('supplier', 'leap'));
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS overrule_reason TEXT;
UPDATE return_cases SET supplier_asked_at = created_at WHERE supplier_asked_at IS NULL;
-- the open returns that already waited more than 48 hours are not all reminded at once on the first run
UPDATE return_cases SET supplier_reminded_at = now() WHERE supplier_answer IS NULL AND status IN ('awaiting', 'in_progress') AND created_at < now() - interval '48 hours';
