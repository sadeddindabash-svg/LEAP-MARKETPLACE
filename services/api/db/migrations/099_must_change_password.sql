-- Migration 099: a person who was given a TEMPORARY password (a new hub staff account, or one an admin reset) must choose their own.
-- The flag is set whenever an admin creates or resets such an account, is reported by login and /auth/me, and is cleared by PATCH /auth/me/password.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
