-- Vehicle data in three languages, and a new level under each Year: the VERSION.
--
-- 1. Chinese names for brands and models (the Arabic names already exist). The columns stay NULLABLE on purpose: brands and models created before this keep working and
--    show no Chinese name until one is added (Edit). New brands and models REQUIRE one (enforced by the server, not by the column).
-- 2. vehicle_versions: one row per version of a vehicle in a given year (for example AITO M5, 2022, "AWD Flagship"), with the version name and the engine description in
--    English, Arabic and Chinese, the number of seats, and an optional photo (a version imported from Excel may have none yet: it is added later by hand).
--    A version belongs to a Year (vehicle_generations) and goes with it if the year is deleted. The same version name with the same engine cannot be added twice to one year.
ALTER TABLE vehicle_brands ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE vehicle_models ADD COLUMN IF NOT EXISTS name_zh TEXT;

CREATE TABLE IF NOT EXISTS vehicle_versions (
  id            TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL REFERENCES vehicle_generations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_ar       TEXT NOT NULL,
  name_zh       TEXT NOT NULL,
  engine        TEXT NOT NULL,
  engine_ar     TEXT NOT NULL,
  engine_zh     TEXT NOT NULL,
  seats         SMALLINT NOT NULL CHECK (seats BETWEEN 1 AND 12),
  photo_url     TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_versions_unique ON vehicle_versions (generation_id, lower(btrim(name)), lower(btrim(engine)));
CREATE INDEX IF NOT EXISTS vehicle_versions_generation ON vehicle_versions (generation_id, sort_order);
