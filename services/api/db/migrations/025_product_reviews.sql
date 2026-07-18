-- Migration 025: real product reviews and ratings.
--
-- CONFIRMED SCOPE, discussed before building: whether a review requires
-- a real verified purchase is ADMIN-DECIDED (a real, toggleable
-- setting, not a hardcoded rule either way) -- reusing the same real
-- platform_settings key-value table introduced in migration 024 rather
-- than a one-off column. Every real review requires real admin
-- moderation before it's visible or counts toward a product's average
-- rating -- the same real quality gate every product listing already
-- goes through, not a different standard for reviews. One real review
-- per product per buyer -- re-submitting is a real edit of the
-- existing review (which sends it back to 'pending' for re-review,
-- since the content genuinely changed), never a second, separate row.
CREATE TABLE IF NOT EXISTS product_reviews (
  id         SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id   TEXT NOT NULL REFERENCES users(id),
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, buyer_id)
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_buyer ON product_reviews(buyer_id);

-- Real, admin-toggleable setting (reusing migration 024's real generic
-- platform_settings table) -- confirmed: whether a review requires a
-- real verified purchase is an admin decision, not fixed either way.
INSERT INTO platform_settings (key, value) VALUES ('require_verified_purchase_for_reviews', 'false') ON CONFLICT (key) DO NOTHING;
