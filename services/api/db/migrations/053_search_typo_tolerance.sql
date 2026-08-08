-- Migration 053: enable pg_trgm for real typo-tolerant search (#20).
--
-- CONFIRMED SCOPE: this only ADDS a real fuzzy-similarity fallback
-- alongside the existing real ILIKE substring matches in
-- buildProductMatchQuery -- it does not replace or change any
-- existing exact/substring match behavior, only catches real typos
-- (e.g. "brake" vs "braek") that the existing ILIKE checks would
-- otherwise miss entirely.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Real trigram index on the buyer-facing product name -- the search
-- query now runs a real similarity() check against this column for
-- every real search, so this index matters for genuine query
-- performance, not just correctness.
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
