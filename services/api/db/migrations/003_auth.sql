-- Migration 003: authentication
-- Adds password storage to the existing users table. Guest checkout users
-- (created via POST /user/guest-claim) have a NULL password_hash until they
-- actually set one up — they are not required to have a password just to
-- have a row in this table.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
