-- Migration 125: a photo for each loyalty tier, set by the admin (Settings -> Tiers Photos). Shown instead of the tier's icon on the website (My tier,
-- the loyalty card) when there is one; NULL keeps the icon. A square 600 x 600 picture, stored like the home page pictures (/uploads/... or a cloud address).
ALTER TABLE loyalty_tiers ADD COLUMN IF NOT EXISTS photo_url TEXT;
