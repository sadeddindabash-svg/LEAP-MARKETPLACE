-- Migration 068: removes the real staging columns/table from the
-- original quote-requests design (migration 067), confirmed obsolete
-- after the person's own direct correction: real Leap staff now
-- fulfil a request item through the supplier portal's own existing,
-- full product submission form (as the "Leap Supplier" account),
-- going through the exact same real requirements as any other real
-- supplier -- there is no longer a real, separate admin-side staging
-- step where a price/category/part/photos get set before any real
-- product exists.

ALTER TABLE quote_request_items DROP COLUMN IF EXISTS draft_price;
ALTER TABLE quote_request_items DROP COLUMN IF EXISTS draft_category;
ALTER TABLE quote_request_items DROP COLUMN IF EXISTS draft_part;

DROP TABLE IF EXISTS quote_request_item_photos;
