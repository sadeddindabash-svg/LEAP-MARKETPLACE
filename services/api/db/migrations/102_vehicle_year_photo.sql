-- A photo for each vehicle YEAR (generation: name + start year + optional end year).
--
-- Until now only brands (required) and models (optional) had a photo; the year level had none. A vehicle is now added in three steps: Brand (English name,
-- Arabic name and photo, all required), Model (English and Arabic name only, no photo) and Year (the year in English digits and a photo, both required).
-- The column stays NULLABLE on purpose: years that already exist have no photo and keep working (the admin list marks them "No photo yet" and offers
-- "Add photo"). The buyer app shows the year photo first, then the brand's.
ALTER TABLE vehicle_generations ADD COLUMN IF NOT EXISTS photo_url TEXT;
