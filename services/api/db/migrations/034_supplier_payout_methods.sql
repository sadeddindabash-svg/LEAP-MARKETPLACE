-- Migration 034: real supplier payout method details.
--
-- CONFIRMED SCOPE: simple, universal fields (bank name, account
-- number, account holder name) -- no country-specific fields (IBAN,
-- routing number, etc.) for now. One real row per supplier -- a
-- supplier has exactly one active real payout destination at a time;
-- updating it replaces the previous real details rather than keeping
-- a history (a real payout already records its own amount and date
-- permanently; it was never going to double as a bank-details audit
-- log).
--
-- A real payout now requires this to exist first -- see
-- services/api/README.md's "Real supplier payout method" section for
-- why recording a payout without one was a genuine, honest gap this
-- migration closes.
CREATE TABLE IF NOT EXISTS supplier_payout_methods (
  supplier_id          TEXT PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
  bank_name            TEXT NOT NULL,
  account_number       TEXT NOT NULL,
  account_holder_name  TEXT NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
