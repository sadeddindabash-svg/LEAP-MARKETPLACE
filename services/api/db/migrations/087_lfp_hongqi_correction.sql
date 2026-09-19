-- Migration 087: confirmed with the person -- LFP corrected from
-- FAW to Hongqi (FAW's own real luxury sub-brand), resolving the
-- genuine conflict held back in migration 086. Adds the third
-- uploaded row (LFPH4ACP, Hongqi H5, 2023) now that the conflict is
-- resolved.

UPDATE vin_wmi_codes SET make = 'Hongqi', updated_at = now() WHERE wmi_prefix = 'LFP';

INSERT INTO vin_model_patterns (prefix, brand, model, type, is_ambiguous, year_min, year_max, example_count, source)
VALUES ('LFPH4ACP', 'Hongqi', 'H5', NULL, FALSE, 2023, 2023, 1, 'Person-uploaded (vehicle_data.xlsx)')
ON CONFLICT (prefix) DO NOTHING;
