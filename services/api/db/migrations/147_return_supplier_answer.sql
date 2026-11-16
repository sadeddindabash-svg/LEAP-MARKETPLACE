-- Migration 147: the supplier sees the buyer's photos of a return and answers it (patch-returns-supplier-answer).
--   supplier_answer       'accept' (agrees to the return) or 'decline' (does not agree; supplier_answer_note says why)
--   The admin still decides (Returns > the case > Approve / Reject); the supplier's answer is shown to the admin beside the case.
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS supplier_answer TEXT;
ALTER TABLE return_cases DROP CONSTRAINT IF EXISTS return_cases_supplier_answer_check;
ALTER TABLE return_cases ADD CONSTRAINT return_cases_supplier_answer_check CHECK (supplier_answer IS NULL OR supplier_answer IN ('accept', 'decline'));
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS supplier_answer_note TEXT;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS supplier_answered_at TIMESTAMPTZ;
