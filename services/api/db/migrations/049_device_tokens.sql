-- Migration 049: real device tokens for push notifications.
--
-- CONFIRMED SCOPE: this is the storage half only. It lets a real
-- device register/unregister its own real FCM token, and lets the
-- backend look up which real tokens belong to a given real user when
-- something notification-worthy happens (see push/client.js's own
-- header comment for the honest split between what's built here and
-- what still needs a real Firebase project's real credentials before
-- anything can actually be delivered to a real device).
--
-- One real user can have more than one real device (phone + tablet,
-- or simply having reinstalled the app), so this is a one-to-many
-- table, not a single token column on `users`. A device re-registering
-- the same real token (e.g. re-opening the app) updates its own row
-- rather than creating a duplicate, via the real unique constraint on
-- (user_id, token) below.
CREATE TABLE IF NOT EXISTS device_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
