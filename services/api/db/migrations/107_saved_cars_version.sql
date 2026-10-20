-- A saved car (My Garage) now carries its VERSION as well: brand, model, year AND version (a version is a row of vehicle_versions, added by hand or by the Excel import).
--
-- version_id stays NULL for cars saved before this existed, and for years that have no versions: those keep working exactly as before.
-- If an admin deletes a version, the cars that pointed at it simply become year-only cars (ON DELETE SET NULL; the delete route tidies up the one case where that
-- would give a buyer the same car twice).
--
-- A car is now identified by buyer + generation + YEAR + VERSION, so two versions of the same year are two cars. The old uniqueness (on buyer, generation and year only)
-- would forbid that, so it is replaced: whatever primary key or unique rule this table had is dropped (found by looking, not by name), and a new unique rule that
-- includes the version is added. A car with no version counts as "version none": the same car cannot be saved twice that way either.
ALTER TABLE user_saved_generations ADD COLUMN IF NOT EXISTS version_id TEXT REFERENCES vehicle_versions(id) ON DELETE SET NULL;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'user_saved_generations'::regclass AND contype IN ('p', 'u') LOOP
    EXECUTE format('ALTER TABLE user_saved_generations DROP CONSTRAINT %I', c.conname);
  END LOOP;
  FOR c IN SELECT i.relname AS name FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
           WHERE x.indrelid = 'user_saved_generations'::regclass AND x.indisunique AND i.relname <> 'user_saved_generations_car' LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', c.name);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_saved_generations_car ON user_saved_generations (buyer_id, generation_id, year, COALESCE(version_id, ''));
CREATE INDEX IF NOT EXISTS user_saved_generations_version ON user_saved_generations (version_id);
