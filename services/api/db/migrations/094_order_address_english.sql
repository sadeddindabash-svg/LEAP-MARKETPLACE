-- Migration 094: an English version of every order's delivery address, for the inspection hub.
--
-- THE GAP: a buyer may type their delivery address in Arabic, but the people at the inspection hub cannot read it, and the printed
-- address label could not show it properly either. The hub needs an English address to ship to.
--
-- order_addresses keeps the address exactly as the buyer entered it (recipient_name, country, city, street_address, state: unchanged,
-- still the legal record). These new columns hold the ENGLISH version, which is what hub staff and the printed label use:
--   english_source  'same'  the address was already in English letters, so nothing was translated
--                   'auto'  produced automatically from Arabic (a dictionary of countries / cities / street words / common names, plus
--                           rules for the rest). APPROXIMATE: Arabic leaves short vowels unwritten. Meant to be confirmed by the buyer.
--                   'buyer' the buyer confirmed or corrected it
--                   'admin' an admin corrected it
--   NULL            an order from before this migration: it is filled in the first time something reads it (nothing is rewritten here)
-- Phone, postal code and national address are not translated: they are digits / codes.
ALTER TABLE order_addresses
  ADD COLUMN IF NOT EXISTS recipient_name_en TEXT,
  ADD COLUMN IF NOT EXISTS country_en TEXT,
  ADD COLUMN IF NOT EXISTS city_en TEXT,
  ADD COLUMN IF NOT EXISTS street_address_en TEXT,
  ADD COLUMN IF NOT EXISTS state_en TEXT,
  ADD COLUMN IF NOT EXISTS english_source TEXT CHECK (english_source IN ('same', 'auto', 'buyer', 'admin')),
  ADD COLUMN IF NOT EXISTS english_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS english_updated_by TEXT;
