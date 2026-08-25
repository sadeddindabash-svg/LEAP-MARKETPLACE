-- Migration 070: real, rule-based delivery-day estimates, confirmed
-- through several rounds of design discussion with the person before
-- building: replaces the previous manual, supplier-typed number
-- entirely with a real admin-configured rule engine matching a real
-- product's weight + volume + warehouse country + the real buyer's
-- own destination country group.

-- Real destination country groups (e.g. "Levant", "Gulf") -- lets one
-- rule cover many real countries at once, rather than needing a
-- separate rule per individual country.
CREATE TABLE IF NOT EXISTS country_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_ar     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Real, confirmed design: iso_code is the real matching key (reliably
-- derived from a real buyer's own IP-based or saved-address country),
-- name is what the admin actually sees/picks from -- kept as a
-- separate, deliberately curated real value rather than an official
-- ISO library's formal name (e.g. this app's own real "China", not
-- "People's Republic of China"), matching this app's own already-
-- established, casual real country-naming convention exactly.
CREATE TABLE IF NOT EXISTS country_group_members (
  id         SERIAL PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES country_groups(id) ON DELETE CASCADE,
  iso_code   TEXT NOT NULL,
  name       TEXT NOT NULL,
  UNIQUE (group_id, iso_code)
);
CREATE INDEX IF NOT EXISTS idx_country_group_members_group ON country_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_country_group_members_iso ON country_group_members(iso_code);

-- Real delivery-day rules, confirmed matching the person's own real
-- description exactly: weight + volume + warehouse country +
-- destination country group -> real delivery days. Every criterion is
-- nullable (a real wildcard, matching any value) so a genuinely
-- catch-all fallback rule can exist. sort_order decides real match
-- precedence -- first matching rule (in this real order) wins,
-- confirmed via a rendered mockup showing drag-to-reorder rows.
CREATE TABLE IF NOT EXISTS delivery_rules (
  id                    TEXT PRIMARY KEY,
  min_weight_kg         NUMERIC(10, 2),
  max_weight_kg         NUMERIC(10, 2),
  min_volume_cm3        NUMERIC(14, 2),
  max_volume_cm3        NUMERIC(14, 2),
  warehouse_country     TEXT,
  destination_group_id  TEXT REFERENCES country_groups(id),
  delivery_days         INTEGER NOT NULL CHECK (delivery_days > 0),
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_rules_sort ON delivery_rules(sort_order);

-- Real, confirmed removal: "i don't want supplier provide that" --
-- the manual, supplier-typed delivery estimate is replaced entirely
-- by the real rule engine above, not kept as a fallback input.
ALTER TABLE products DROP COLUMN IF EXISTS estimated_delivery_days;
