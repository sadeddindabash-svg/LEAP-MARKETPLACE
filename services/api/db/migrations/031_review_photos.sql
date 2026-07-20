-- Migration 031: real photos on product reviews.
--
-- CONFIRMED SCOPE: up to 3 real photos per review, optional -- a
-- review remains valid with just a rating and no photos, same as
-- before this migration. Reuses the same real upload endpoint already
-- built for supplier product photos and hub evidence photos (POST
-- /uploads/product-image) -- the actual work there (validate real
-- dimensions/type, save, return a real URL) is identical regardless of
-- what the photo is evidence of.
CREATE TABLE IF NOT EXISTS review_photos (
  id          SERIAL PRIMARY KEY,
  review_id   INTEGER NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_review_photos_review ON review_photos(review_id);
