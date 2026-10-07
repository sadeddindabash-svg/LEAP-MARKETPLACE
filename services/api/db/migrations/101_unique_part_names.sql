-- Migration 101: a category cannot have two parts with the same name.
--
-- The server used to accept the same part name any number of times: repeated test runs left ~26 copies of "Front Brake Disc" in the Brake category, and
-- every one of them showed up in the supplier's part list. Products refer to a part by its NAME (not by its id), so merging the copies is safe: one row
-- per (category, name, ignoring capitals and extra spaces) is kept, preferring the row that has a photo, then the oldest.
DELETE FROM category_parts
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY category_id, lower(btrim(name_en))
      ORDER BY (photo_url IS NOT NULL) DESC, created_at ASC NULLS LAST, id ASC
    ) AS position
    FROM category_parts
  ) ranked
  WHERE position > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS category_parts_name_unique ON category_parts (category_id, lower(btrim(name_en)));
