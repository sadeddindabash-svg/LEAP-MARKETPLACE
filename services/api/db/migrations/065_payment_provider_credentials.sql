-- Migration 065: real, encrypted, admin-editable payment provider
-- credentials -- separate from payment_methods (migration 063/064),
-- which is purely the display/catalog layer (name, photo, which
-- countries see it). This table is the real credential/connection
-- layer for actually processing payments through a real gateway.
--
-- Deliberately stores only an encrypted JSON blob per provider, never
-- plain text at rest -- decrypted only in memory, at the moment a
-- real payment request actually needs to use it. The master
-- encryption key itself lives in an environment variable
-- (CREDENTIALS_ENCRYPTION_KEY), not in this database, since it must
-- be available at server startup and should never be admin-editable
-- through the portal itself.

CREATE TABLE IF NOT EXISTS payment_provider_credentials (
  provider_id TEXT PRIMARY KEY,
  -- Real, encrypted (AES-256-GCM) JSON blob of this provider's own
  -- real credential fields (e.g. Stripe: {secretKey, webhookSecret};
  -- APS: {merchantIdentifier, accessCode, shaRequestPhrase,
  -- shaResponsePhrase}). Format: "iv:authTag:ciphertext", all
  -- hex-encoded.
  encrypted_credentials TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);
