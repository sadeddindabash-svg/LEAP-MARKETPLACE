-- Migration 051: real TOTP-based two-factor authentication (RFC 6238,
-- the same real standard Google Authenticator/Authy use).
--
-- CONFIRMED, deliberate design: two_factor_pending_secret is kept
-- SEPARATE from two_factor_secret. A real setup attempt (scanning a
-- real QR code into an authenticator app) must be PROVEN with a real,
-- correct code before it's ever promoted to the real, active secret
-- -- otherwise a person who generates a new setup but never actually
-- finishes it (e.g. closes the app mid-setup) could silently lock
-- themselves out of a previously-working real 2FA setup, or -- worse
-- -- an attacker with a moment of account access could silently swap
-- in a secret of their own without ever having to prove it actually
-- works.
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_pending_secret TEXT;
