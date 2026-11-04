-- Migration 129: the inspection list's ticks, kept per order line (the keys of the lines the hub confirmed against the real part), so the hub
-- portal and the hub app show the same list with the same ticks, and the "Confirm Inspected" step can be refused until every line is ticked and
-- every item's received quantity is entered (see src/modules/inspection/service.js).
ALTER TABLE order_line_items ADD COLUMN IF NOT EXISTS inspection_checks JSONB NOT NULL DEFAULT '[]'::jsonb;
