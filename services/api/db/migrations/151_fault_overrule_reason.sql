-- Migration 151: when Leap confirms a fault although the supplier did not accept the return, the reason (sent to the supplier)
-- (patch-fault-overrule-reason).
ALTER TABLE fault_cases ADD COLUMN IF NOT EXISTS overrule_reason TEXT;
