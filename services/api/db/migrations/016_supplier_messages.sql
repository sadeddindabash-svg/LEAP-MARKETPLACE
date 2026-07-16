-- Migration 016: real supplier <-> platform messaging, with real
-- bidirectional auto-translation (Chinese <-> English).
--
-- CONFIRMED REQUIREMENT: a supplier writes in Chinese, admin sees it
-- auto-translated to English; admin writes in English, supplier sees
-- it auto-translated to Chinese. Deliberately a SEPARATE system from
-- support_tickets (migration 005) -- that system exists specifically to
-- enforce "buyers never contact suppliers directly"; this is a
-- genuinely different relationship (supplier <-> platform, day-to-day),
-- not a variant of buyer support.
--
-- CONFIRMED DESIGN: translate ONCE at send time, store BOTH the
-- original text and the translated text -- not translate-on-every-read.
-- Faster, cheaper (no repeated API calls just to redisplay the same
-- message), and the translation stays consistent even if the
-- translation service's quality changes later. Both the original and
-- the translation are always retrievable -- auto-translation isn't
-- perfect, and either side should be able to see the real original
-- text, not just trust a translation blindly (same principle as the
-- Moderation page showing a supplier's real Chinese original alongside
-- the reviewed English translation).
CREATE TABLE IF NOT EXISTS supplier_messages (
  id                   SERIAL PRIMARY KEY,
  supplier_id          TEXT NOT NULL REFERENCES suppliers(id),
  sender_role          TEXT NOT NULL CHECK (sender_role IN ('supplier', 'admin')),
  sender_id            TEXT REFERENCES users(id),
  original_text        TEXT NOT NULL,
  original_language    TEXT NOT NULL CHECK (original_language IN ('zh', 'en')),
  translated_text       TEXT, -- NULL if translation genuinely failed/unavailable -- not a fabricated fallback
  translated_language   TEXT,
  translation_status   TEXT NOT NULL DEFAULT 'unavailable' CHECK (translation_status IN ('success', 'unavailable')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_messages_supplier ON supplier_messages(supplier_id, created_at);
