-- Migration 082: real corrections and additions to vin_wmi_codes,
-- confirmed with the person via live web search against sourced
-- references (Wikipedia-derived WMI lists cross-checked against each
-- other, plus a real decoded VIN example for LMG) -- not a second
-- guess from memory, the exact gap the original migration 081 seed
-- data flagged as a risk.
--
-- CORRECTIONS: three codes in the original 081 seed were wrong.
-- LSJ is actually MG Motor / SAIC (was mislabeled Geely). LFP is
-- actually FAW's own passenger-vehicle code (was mislabeled Great
-- Wall/Haval). L6T is actually Geely (was mislabeled Chery). LZW
-- never appeared in either cross-checked source at all and is
-- removed -- the real MG/SAIC code is LSJ, corrected above.
UPDATE vin_wmi_codes SET make = 'MG (SAIC)' WHERE wmi_prefix = 'LSJ';
UPDATE vin_wmi_codes SET make = 'FAW' WHERE wmi_prefix = 'LFP';
UPDATE vin_wmi_codes SET make = 'Geely' WHERE wmi_prefix = 'L6T';
DELETE FROM vin_wmi_codes WHERE wmi_prefix = 'LZW';

-- ADDITIONS: real, additional Chinese manufacturer codes found via
-- the same real cross-checked sources, not previously in this table
-- at all.
INSERT INTO vin_wmi_codes (wmi_prefix, make, country) VALUES
  ('LGB', 'Dongfeng (DFM)', 'China'),
  ('LJC', 'JAC', 'China'),
  ('LJ1', 'JAC', 'China'),
  ('LSY', 'Brilliance Zhonghua', 'China'),
  ('LVZ', 'Dongfeng Sokon (DFSK)', 'China'),
  ('LGH', 'Qoros', 'China'),
  ('LZG', 'Shaanxi Automobile Group', 'China'),
  ('LUZ', 'Hozon Auto (Neta)', 'China')
ON CONFLICT (wmi_prefix) DO NOTHING;
