-- Migration 028: real live FX rate (Frankfurter.app), toggleable
-- against the existing real manual fallback.
--
-- CONFIRMED SCOPE, discussed before building: a real automatic/manual
-- toggle, not a one-way automatic switch -- fx_rates.source already
-- anticipated a real 'live' value (see migration 014's own header
-- comment), this migration is what actually wires that up. Defaults to
-- 'manual' -- the existing, already-working real fallback -- so
-- applying this migration causes zero real behavior change until an
-- admin explicitly switches it on.

INSERT INTO platform_settings (key, value) VALUES ('fx_rate_mode', 'manual') ON CONFLICT (key) DO NOTHING;
