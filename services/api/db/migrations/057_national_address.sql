-- Migration 057: real Saudi National Address field.
--
-- CONFIRMED SCOPE: nullable -- only ever populated for a real address
-- where the country is genuinely Saudi Arabia; every other real,
-- existing address simply has no value here, never a fabricated one.
ALTER TABLE buyer_addresses ADD COLUMN IF NOT EXISTS national_address TEXT;
