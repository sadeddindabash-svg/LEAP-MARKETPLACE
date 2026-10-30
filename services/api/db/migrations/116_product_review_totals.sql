-- Product cards (app and website) read products.rating and products.review_count.
-- Approving a review never updated them, so every card said "No reviews yet".
-- From now on the reviews routes keep them up to date (approved reviews only). This fills them in once.
ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating numeric(3,2);
UPDATE products SET review_count = 0 WHERE review_count IS DISTINCT FROM 0;
UPDATE products p SET review_count = s.cnt, rating = s.avg
FROM (SELECT product_id, COUNT(*)::int AS cnt, ROUND(AVG(rating)::numeric, 2) AS avg FROM product_reviews WHERE status = 'approved' GROUP BY product_id) s
WHERE p.id = s.product_id;
