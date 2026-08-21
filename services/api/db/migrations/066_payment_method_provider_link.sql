-- Migration 066: real link between payment_methods (the display/
-- catalog layer -- name, photo, which countries see it) and
-- payment_provider_credentials (the real credential/connection
-- layer). Without this, a payment method has no way to say which
-- real gateway it should actually charge through.
--
-- Nullable -- an existing (or newly created) method with no
-- real provider assigned yet simply can't be checked out with. This
-- is surfaced clearly to the admin and to checkout, rather than
-- silently defaulting to some real gateway that was never actually
-- confirmed for that method.

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS provider_id TEXT;
