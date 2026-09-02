-- Migration 080: real state and Saudi National Address fields on the
-- order's own permanent address snapshot.
--
-- Confirmed with the person: these already exist on buyer_addresses
-- (migrations 057/058) but were never copied over to
-- order_addresses -- needed now for the hub's delivery-address PDF,
-- which must read from the order's own permanent snapshot (never a
-- live reference to a buyer's saved address that could change or be
-- deleted later).
--
-- CONFIRMED SCOPE, same as the original buyer_addresses columns:
-- both nullable -- national_address only ever populated for a real
-- Saudi Arabia address, state only when the selected real country
-- genuinely has real states in its own bundled data.
ALTER TABLE order_addresses ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE order_addresses ADD COLUMN IF NOT EXISTS national_address TEXT;
