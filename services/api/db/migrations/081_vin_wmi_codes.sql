-- Migration 081: real VIN WMI (World Manufacturer Identifier) lookup
-- table, for a basic in-house VIN decoder.
--
-- CONFIRMED SCOPE, discussed with the person: NHTSA's free vPIC API
-- covers make/model-year decoding well for the US market, but has
-- little to no coverage for Chinese-brand vehicles (rarely sold in
-- the US). This table is a manually-curated supplement specifically
-- for Chinese manufacturers relevant to this marketplace's own real
-- supplier base, looked up FIRST before falling back to NHTSA.
--
-- HONEST LIMITATION: WMI assignments are a large, evolving real-world
-- registry, and a manufacturer can hold several WMI codes across
-- different plants, models, and export markets. The seed data below
-- is a best-effort starting set of widely-documented codes, not a
-- verified-complete list -- admin-editable via the catalog's Vehicle
-- Data page precisely so it can be corrected and expanded over time
-- as real VINs are actually decoded and checked.
CREATE TABLE IF NOT EXISTS vin_wmi_codes (
  wmi_prefix  TEXT PRIMARY KEY CHECK (char_length(wmi_prefix) = 3),
  make        TEXT NOT NULL,
  country     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO vin_wmi_codes (wmi_prefix, make, country) VALUES
  ('LSJ', 'Geely', 'China'),
  ('LB3', 'Geely', 'China'),
  ('LGX', 'BYD', 'China'),
  ('LC0', 'BYD', 'China'),
  ('LGW', 'Great Wall / Haval', 'China'),
  ('LFP', 'Great Wall / Haval', 'China'),
  ('LS5', 'Changan', 'China'),
  ('LS6', 'Changan', 'China'),
  ('LVV', 'Chery', 'China'),
  ('L6T', 'Chery', 'China'),
  ('LMG', 'GAC (Trumpchi)', 'China'),
  ('LFV', 'FAW-Volkswagen', 'China'),
  ('LZW', 'MG (SAIC)', 'China'),
  ('LSG', 'SAIC-GM (Buick/Chevrolet China)', 'China')
ON CONFLICT (wmi_prefix) DO NOTHING;
