-- Migration 073: adds a real, single original_price column directly
-- on products, confirmed with the person through several rounds of
-- design (5 label options, then color options, then dark mode) before
-- building: the real product-card discount label design #3
-- (struck-through original price + a real percentage-off tag,
-- classic sale red #D32F2F with white text, confirmed to need no
-- separate dark-mode variant).
--
-- Deliberately a single nullable column, not a separate discount
-- table or a stored percentage: original_price is the one real source
-- of truth (nullable = no real discount active at all), and the
-- displayed percentage is always computed fresh from
-- (original_price - price) / original_price -- avoids the real risk
-- of a stored percentage silently drifting out of sync with price if
-- price changes later without the percentage being updated too.
--
-- Same NUMERIC(12, 2) precision as the real price column right above
-- it, for consistency.

ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC(12, 2);
