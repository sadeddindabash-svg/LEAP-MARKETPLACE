-- Migration 009: password reset tokens (BUY-002-ish, applies equally to
-- admin/supplier logins since they're all rows in the same `users` table).
--
-- Deliberately a SEPARATE table rather than columns on `users` — a user
-- could theoretically request a reset twice before using the first link;
-- a separate table lets old tokens simply become invalid/superseded
-- without needing extra bookkeeping columns, and keeps `users` itself
-- free of transient state.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
