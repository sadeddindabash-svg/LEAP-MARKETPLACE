-- Migration 064: real, global master on/off switch for a payment
-- method -- confirmed with the person: separate from and independent
-- of per-country activation (payment_method_countries). Lets an
-- admin quickly disable a method everywhere (e.g. a gateway is down
-- for maintenance) without losing its per-country configuration.
-- Defaults to active so existing methods aren't silently hidden by
-- this new column appearing.

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
