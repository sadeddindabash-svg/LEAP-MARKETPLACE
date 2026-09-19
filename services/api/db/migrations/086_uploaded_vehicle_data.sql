-- Migration 086: real vehicle data from a person-uploaded file
-- (vehicle_data.xlsx), added directly by request -- confirmed
-- automatic workflow: the person supplies real vehicle data, this
-- gets sorted into both the WMI (3-char) and model-pattern
-- (8-char) tables without a separate review step.
--
-- Two of the three rows in this specific upload had no conflict
-- with existing data and are included here. The third row
-- (LFPH4ACP, Hongqi) is held back -- LFP already exists in
-- vin_wmi_codes as FAW, and Hongqi is FAW's own luxury sub-brand,
-- so this is a genuine, real ambiguity (not a data error) flagged
-- directly with the person rather than silently overwritten.

-- LVV (Chery) already exists in vin_wmi_codes -- confirmed no
-- conflict, this row's own brand matches exactly. Adds the new,
-- more precise model-level match.
INSERT INTO vin_model_patterns (prefix, brand, model, type, is_ambiguous, year_min, year_max, example_count, source)
VALUES ('LVVDC24B', 'Chery', 'A5/Fora', NULL, FALSE, 2007, 2007, 1, 'Person-uploaded (vehicle_data.xlsx)')
ON CONFLICT (prefix) DO NOTHING;

-- LGJ (DongFeng Aeolus) is a real, new WMI code -- not previously in
-- vin_wmi_codes at all.
INSERT INTO vin_wmi_codes (wmi_prefix, make, country) VALUES
  ('LGJ', 'DongFeng Aeolus', 'China')
ON CONFLICT (wmi_prefix) DO NOTHING;

INSERT INTO vin_model_patterns (prefix, brand, model, type, is_ambiguous, year_min, year_max, example_count, source)
VALUES ('LGJE1EE0', 'DongFeng Aeolus', 'Aeolus Shine', NULL, FALSE, 2023, 2023, 1, 'Person-uploaded (vehicle_data.xlsx)')
ON CONFLICT (prefix) DO NOTHING;
