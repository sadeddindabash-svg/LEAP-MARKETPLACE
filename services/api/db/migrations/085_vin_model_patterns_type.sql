-- Migration 085: adds a real "type" column to vin_model_patterns
-- (PHEV / Electric / Hybrid / NULL for standard combustion) --
-- confirmed with the person, who asked for this shown directly in
-- the new admin table for the model-pattern data (Vehicle Data page).
--
-- Auto-classified from each real model name (PHEV/Hybrid/EV keyword
-- match), then backfilled for the existing 69 unambiguous real rows
-- already seeded in migration 083. Not re-guessed or invented -- this
-- is a real, mechanical read of what the person's own real dataset
-- already spelled out in each model's own name (e.g. "CS75 PHEV",
-- "Dargo Hybrid", "CS15 EV").
ALTER TABLE vin_model_patterns ADD COLUMN IF NOT EXISTS type TEXT;

UPDATE vin_model_patterns AS v SET type = u.type
FROM (VALUES
  ('LS5A2ASE', NULL),
  ('LS6A3E03', 'Electric'),
  ('LS5A3ASE', NULL),
  ('LS5A3AJC', 'Electric'),
  ('LS5A3ADE', NULL),
  ('LS5A3AFE', NULL),
  ('LS5A3AKR', NULL),
  ('LS5A3AHE', NULL),
  ('LS4ASE2W', NULL),
  ('LS6C3G0K', 'PHEV'),
  ('LS5A2AHD', NULL),
  ('LS6A3E0E', NULL),
  ('LS5A2AFE', NULL),
  ('LS5A2AKR', NULL),
  ('LS5A3AKE', NULL),
  ('LS5A3DJW', NULL),
  ('LS5A3DKE', NULL),
  ('LS5A2DJW', NULL),
  ('LS5A2DKE', NULL),
  ('L6T7804S', NULL),
  ('L6T7804Z', NULL),
  ('L6T79F4Z', 'PHEV'),
  ('LB378GCZ', NULL),
  ('LB37954S', NULL),
  ('LB37954Z', NULL),
  ('L6T78A4W', 'Electric'),
  ('L6T78U2W', 'Electric'),
  ('LB37814S', NULL),
  ('LB37814Z', NULL),
  ('LB37844S', NULL),
  ('LB37844Z', NULL),
  ('LB37712Z', NULL),
  ('LB37742Z', NULL),
  ('LB3784EZ', NULL),
  ('L6T78F4Z', 'PHEV'),
  ('L6T7712S', NULL),
  ('L6T7712Z', NULL),
  ('L6T7722S', NULL),
  ('L6T7722Z', NULL),
  ('L6T783EZ', NULL),
  ('L106D2A5', NULL),
  ('L6T7942Z', NULL),
  ('L6T7952Z', NULL),
  ('LB3709DN', NULL),
  ('LB370ADN', NULL),
  ('LB37852D', NULL),
  ('LB37852Z', NULL),
  ('L6T7622Z', NULL),
  ('LGWEF5A6', NULL),
  ('LGWEFUA6', 'Hybrid'),
  ('LGWED2A3', NULL),
  ('LGWEFCA5', NULL),
  ('LGWFFCA5', NULL),
  ('LGWEFDA5', NULL),
  ('LGWFF5A5', NULL),
  ('LGWFFDA5', NULL),
  ('LGWFFEA5', NULL),
  ('LGWEFUA5', 'Hybrid'),
  ('LGWEF6A7', NULL),
  ('LGWEF8A7', NULL),
  ('LGWEFGA7', NULL),
  ('LGWFF6A7', NULL),
  ('LGWFF8A7', NULL),
  ('LGWFFGA7', NULL),
  ('LGWFF6A6', NULL),
  ('LGWFF7A6', NULL),
  ('LGWFF8A6', NULL),
  ('LGWFFGA6', NULL),
  ('LGWFG7A6', NULL)
) AS u(prefix, type)
WHERE v.prefix = u.prefix;
