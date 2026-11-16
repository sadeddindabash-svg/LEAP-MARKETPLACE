-- Migration 142: a vehicle version may have up to 60 seats (it was 12). Buses and minibuses (JMC Fushun / Teshun: 15 and 17 seats) were refused by the import.
-- The old check is found by what it says (its name may differ), dropped, and replaced. Every existing row (1 to 12) still satisfies the new one. Safe to run again.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'vehicle_versions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%seats%' LOOP
    EXECUTE format('ALTER TABLE vehicle_versions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE vehicle_versions ADD CONSTRAINT vehicle_versions_seats_check CHECK (seats BETWEEN 1 AND 60);
