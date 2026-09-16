-- Migration 083: real, model-specific VIN prefix decoding for
-- Chinese brands -- confirmed with the person, who supplied a real
-- structured dataset sourced from 17vin.com (a dedicated Chinese-
-- vehicle VIN decoding service), containing 1,259 real model/trim
-- entries backed by 25,068 real individual VIN examples.
--
-- The person's own stated scope: decode brand, model, and year --
-- forget anything more complicated. This table is the real, direct
-- answer for the "model" part specifically for Chinese brands, since
-- NHTSA (the existing fallback for non-Chinese brands) has little to
-- no coverage there at all.
--
-- HONEST LIMITATION, found and confirmed directly in the person's
-- own real data before building on it, not assumed: the 8-character
-- prefix (WMI + VDS) is NOT always unique to one model. Some
-- manufacturers (confirmed: Changan, Geely, Haval) genuinely reuse
-- the same prefix across related, platform-sharing models spanning
-- several model years (e.g. LS4ASE2E covers Changan CS75, CS75 PHEV,
-- AND CS85 COUPE across 2016-2023). is_ambiguous flags this: FALSE
-- means every real example for this prefix agreed on one model (high
-- confidence, safe to auto-resolve); TRUE means multiple real models
-- share this prefix (the decoder should NOT silently pick one --
-- falls back to the existing brand-only handoff instead, same
-- honest behavior as before this table existed).
--
-- model reflects the single most common real model among this
-- prefix's own real examples (relevant even when is_ambiguous is
-- true, as a labeled best-guess, not a claim of certainty).
CREATE TABLE IF NOT EXISTS vin_model_patterns (
  prefix          TEXT PRIMARY KEY CHECK (char_length(prefix) = 8),
  brand           TEXT NOT NULL,
  model           TEXT NOT NULL,
  is_ambiguous    BOOLEAN NOT NULL DEFAULT FALSE,
  year_min        INTEGER,
  year_max        INTEGER,
  example_count   INTEGER NOT NULL DEFAULT 0,
  source          TEXT NOT NULL DEFAULT '17vin.com (person-provided real vehicle data export)',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO vin_model_patterns (prefix, brand, model, is_ambiguous, year_min, year_max, example_count) VALUES
  ('LS4ASE2E', 'Changan', 'CS75', TRUE, 2016, 2023, 49),
  ('LS4ASE2W', 'Changan', 'CS75', FALSE, 2015, 2018, 9),
  ('LS4ASE2A', 'Changan', 'CS95', TRUE, 2014, 2024, 55),
  ('LS6C3G0K', 'Changan', 'CS75 PHEV', FALSE, 2019, 2019, 2),
  ('LS5A3ABE', 'Changan', 'CS35', TRUE, 2014, 2022, 30),
  ('LS5A3ASE', 'Changan', 'CS15', FALSE, 2016, 2021, 13),
  ('LS5A3AJC', 'Changan', 'CS15 EV', FALSE, 2018, 2019, 4),
  ('LS5A3ADE', 'Changan', 'CS35', FALSE, 2014, 2017, 10),
  ('LS5A3AEE', 'Changan', 'CS55', TRUE, 2017, 2019, 11),
  ('LS5A3AKR', 'Changan', 'CS35 PLUS', FALSE, 2019, 2022, 2),
  ('LS5A3AFE', 'Changan', 'CS35 PLUS', FALSE, 2022, 2022, 2),
  ('LS5A3AHE', 'Changan', 'CS55', FALSE, 2017, 2019, 6),
  ('LS5A2ABR', 'Changan', 'Alsvin sedan', TRUE, 2018, 2021, 5),
  ('LS5A2ASE', 'Changan', 'Alsvin sedan', FALSE, 2018, 2019, 3),
  ('LS5A2AKE', 'Changan', 'Alsvin sedan', TRUE, 2012, 2024, 2),
  ('LS5A2AFE', 'Changan', 'Eado PLUS', FALSE, 2020, 2022, 6),
  ('LS5A2ABE', 'Changan', 'Eado', TRUE, 2016, 2022, 16),
  ('LS5A2AKR', 'Changan', 'Eado PLUS', FALSE, 2020, 2022, 6),
  ('LS5A2AEE', 'Changan', 'Eado', TRUE, 2016, 2020, 8),
  ('LS5A2AGE', 'Changan', 'Eado DT', TRUE, 2012, 2021, 9),
  ('LS6A3E03', 'Changan', 'Benben E-Star', FALSE, 2020, 2020, 2),
  ('LS5A3DKE', 'Changan', 'UNI-T', FALSE, 2022, 2023, 12),
  ('LS5A3DJW', 'Changan', 'UNI-T', FALSE, 2022, 2022, 3),
  ('LS5A3AKE', 'Changan', 'UNI-T', FALSE, 2020, 2021, 6),
  ('LS5A2DKE', 'Changan', 'UNI-V', FALSE, 2022, 2025, 12),
  ('LS5A2DJW', 'Changan', 'UNI-V', FALSE, 2022, 2023, 4),
  ('LS5A2AHD', 'Changan', 'Eado DT', FALSE, 2018, 2018, 1),
  ('LS6A3E0E', 'Changan', 'Eado ET', FALSE, 2019, 2019, 2),
  ('LGWEE5A5', 'Haval', 'F5', TRUE, 2018, 2020, 21),
  ('LGWEE4A5', 'Haval', 'H4', TRUE, 2018, 2026, 18),
  ('LGWEF5A5', 'Haval', 'F7', TRUE, 2013, 2024, 55),
  ('LGWEF6A5', 'Haval', 'H6 COUPE Blue Label', TRUE, 2015, 2022, 21),
  ('LGWFF6A5', 'Haval', 'Big Dog', TRUE, 2015, 2022, 17),
  ('LGWEF7A5', 'Haval', 'F7', TRUE, 2019, 2021, 10),
  ('LGWFF7A5', 'Haval', 'F7', TRUE, 2019, 2024, 4),
  ('LGWED2A3', 'Haval', 'H1 red label', FALSE, 2016, 2017, 12),
  ('LGWED2A4', 'Haval', 'H1 Blue Label', TRUE, 2015, 2017, 16),
  ('LGWEE4A4', 'Haval', 'H2 red label', TRUE, 2014, 2019, 64),
  ('LGWFE4A4', 'Haval', 'H2 red label', TRUE, 2014, 2017, 13),
  ('LGWEF3A5', 'Haval', 'H3', TRUE, 2010, 2015, 12),
  ('LGWFF3A5', 'Haval', 'H3', TRUE, 2010, 2013, 6),
  ('LGWEFCA5', 'Haval', 'H3', FALSE, 2009, 2010, 3),
  ('LGWFFCA5', 'Haval', 'H3', FALSE, 2010, 2010, 1),
  ('LGWFFDA5', 'Haval', 'H5', FALSE, 2015, 2025, 3),
  ('LGWFF5A5', 'Haval', 'H5', FALSE, 2013, 2018, 6),
  ('LGWEFDA5', 'Haval', 'H5', FALSE, 2016, 2016, 2),
  ('LGWEFEA5', 'Haval', 'H5', TRUE, 2015, 2018, 6),
  ('LGWFFEA5', 'Haval', 'H5', FALSE, 2015, 2015, 3),
  ('LGWEF4A5', 'Haval', 'M6', TRUE, 2015, 2023, 55),
  ('LGWEF7A6', 'Haval', 'H7', TRUE, 2016, 2023, 34),
  ('LGWFF8A7', 'Haval', 'H8', FALSE, 2017, 2017, 3),
  ('LGWFFGA7', 'Haval', 'H8', FALSE, 2017, 2017, 2),
  ('LGWEFGA7', 'Haval', 'H8', FALSE, 2017, 2017, 2),
  ('LGWEF8A7', 'Haval', 'H8', FALSE, 2017, 2017, 2),
  ('LGWFF6A7', 'Haval', 'H8', FALSE, 2015, 2015, 6),
  ('LGWEF6A7', 'Haval', 'H8', FALSE, 2015, 2015, 5),
  ('LGWFF6A6', 'Haval', 'H9', FALSE, 2015, 2016, 15),
  ('LGWFF8A6', 'Haval', 'H9', FALSE, 2017, 2017, 5),
  ('LGWFFGA6', 'Haval', 'H9', FALSE, 2017, 2017, 3),
  ('LGWFG7A6', 'Haval', 'H9', FALSE, 2022, 2022, 1),
  ('LGWFF7A6', 'Haval', 'H9', FALSE, 2020, 2022, 12),
  ('LGWEFUA5', 'Haval', 'H6S hybrid', FALSE, 2022, 2022, 2),
  ('LGWEF5A6', 'Haval', 'Dargo', FALSE, 2022, 2023, 6),
  ('LGWEFUA6', 'Haval', 'Dargo Hybrid', FALSE, 2022, 2023, 6),
  ('LB37954S', 'Geely', 'EC8', FALSE, 2015, 2015, 4),
  ('LB37954Z', 'Geely', 'EC8', FALSE, 2015, 2015, 2),
  ('LB37742S', 'Geely', 'GX7', TRUE, 2015, 2019, 5),
  ('L106D2A5', 'Geely', 'GX7', FALSE, 2014, 2014, 2),
  ('LB37824Z', 'Geely', 'Emgrand GL', TRUE, 2018, 2026, 30),
  ('LB37824S', 'Geely', 'Emgrand GL', TRUE, 2018, 2023, 7),
  ('L6T783EZ', 'Geely', 'Emgrand Sedan', FALSE, 2022, 2022, 1),
  ('L6T7824Z', 'Geely', 'Emgrand Sedan', TRUE, 2018, 2023, 20),
  ('L6T7824S', 'Geely', 'Emgrand Sedan', TRUE, 2016, 2021, 14),
  ('L6T7722S', 'Geely', 'Emgrand RS Hatchback', FALSE, 2016, 2017, 2),
  ('L6T7712S', 'Geely', 'Emgrand RS Hatchback', FALSE, 2016, 2017, 2),
  ('L6T7722Z', 'Geely', 'Emgrand RS Hatchback', FALSE, 2017, 2017, 1),
  ('L6T7712Z', 'Geely', 'Emgrand RS Hatchback', FALSE, 2015, 2017, 2),
  ('LB37844S', 'Geely', 'Emgrand GL', FALSE, 2017, 2019, 6),
  ('LB37814S', 'Geely', 'Emgrand GL', FALSE, 2017, 2017, 1),
  ('LB37844Z', 'Geely', 'Emgrand GL', FALSE, 2017, 2020, 4),
  ('LB37814Z', 'Geely', 'Emgrand GL', FALSE, 2017, 2017, 3),
  ('LB37722S', 'Geely', 'Emgrand GS', TRUE, 2019, 2021, 4),
  ('LB37742Z', 'Geely', 'Emgrand GS', FALSE, 2019, 2019, 1),
  ('LB37722Z', 'Geely', 'Emgrand GS', TRUE, 2019, 2024, 13),
  ('LB37712Z', 'Geely', 'Emgrand GS', FALSE, 2017, 2017, 1),
  ('LB378U4W', 'modified', 'Emgrand EV', TRUE, 2021, 2021, 4),
  ('L6T78A4W', 'Geely', 'Emgrand EV', FALSE, 2022, 2022, 1),
  ('L6T78U2W', 'Geely', 'Emgrand EV', FALSE, 2021, 2021, 2),
  ('LB378Y4W', 'Geely', 'Emgrand EV450', TRUE, 2017, 2018, 9),
  ('L6T78F4Z', 'Geely', 'Emgrand PHEV', FALSE, 2017, 2017, 3),
  ('L6T78Y4W', 'Geely', 'Emgrand EV300', TRUE, 2016, 2017, 6),
  ('L6T7822Z', 'Geely', 'Boyue L/Azkarra L/Atlas L', TRUE, 2019, 2023, 6),
  ('L6T7852Z', 'Geely', 'Tugella', TRUE, 2019, 2023, 11),
  ('L6T7852D', 'Geely', 'Tugella', TRUE, 2019, 2021, 5),
  ('L6T7804S', 'Geely', 'Binray', FALSE, 2019, 2020, 4),
  ('L6T7804Z', 'Geely', 'Binray', FALSE, 2018, 2020, 10),
  ('L6T7622Z', 'Geely', 'icon', FALSE, 2020, 2026, 13),
  ('L6T7942Z', 'Geely', 'Okavango', FALSE, 2020, 2022, 18),
  ('L6T79F4Z', 'Geely', 'Borui PHEV ePro', FALSE, 2021, 2022, 5),
  ('L6T7854Z', 'Geely', 'Preface', TRUE, 2021, 2024, 15),
  ('LB37852Z', 'Geely', 'Tugella/Monjaro', FALSE, 2021, 2024, 9),
  ('LB37852D', 'Geely', 'Tugella/Monjaro', FALSE, 2021, 2021, 1),
  ('LB3784EZ', 'Geely', 'Emgrand L', FALSE, 2022, 2022, 1),
  ('LB378GCZ', 'Geely', 'Boyue L/Azkarra L/Atlas L', FALSE, 2024, 2024, 1),
  ('L6T7952Z', 'Geely', 'Okavango L', FALSE, 2023, 2024, 6),
  ('L107722Z', 'Geely', 'Okavango L', TRUE, 2024, 2025, 2),
  ('LB370ADN', 'Geely', 'Panda Mini', FALSE, 2023, 2025, 6),
  ('LB3709DN', 'Geely', 'Panda Mini', FALSE, 2023, 2023, 3)
ON CONFLICT (prefix) DO NOTHING;

-- Confirmed via this same real dataset: two genuine WMI codes were
-- missing from vin_wmi_codes entirely, discovered as a direct
-- consequence of building this feature -- real vehicles in the
-- person's own provided data use these exact prefixes.
INSERT INTO vin_wmi_codes (wmi_prefix, make, country) VALUES
  ('LS4', 'Changan', 'China'),
  ('L10', 'Geely', 'China')
ON CONFLICT (wmi_prefix) DO NOTHING;
