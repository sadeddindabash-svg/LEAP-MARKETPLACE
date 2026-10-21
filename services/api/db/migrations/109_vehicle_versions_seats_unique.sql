-- Migration 109: a vehicle VERSION is the same only if its SEATS are the same too.
--
-- A 5-seat and a 7-seat "May Day" of the same model, year and engine are two different vehicles (buyers choose between them by their seats), but the old rule (generation, name, engine)
-- allowed only one. The rule now also includes the seats (a version always has seats, 1 to 12). It is only WEAKER than the old one, so every existing row still satisfies it.
-- Safe to run more than once.
DROP INDEX IF EXISTS vehicle_versions_unique;
DROP INDEX IF EXISTS vehicle_versions_unique_seats;
CREATE UNIQUE INDEX vehicle_versions_unique_seats ON vehicle_versions (generation_id, lower(btrim(name)), lower(btrim(engine)), seats);
