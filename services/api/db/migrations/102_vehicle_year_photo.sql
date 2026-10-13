-- A photo for each vehicle YEAR (generation: name + start year + optional end year).
--
-- Until now only brands (required) and models (optional) had a photo; the year level had none. The photo requirement moves to the year level: it is
-- now required when an admin ADDS a year, and no longer required for a brand. The column stays NULLABLE on purpose: years that already exist have no
-- photo and keep working (the admin list marks them "No photo yet" and offers "Add photo"). The buyer app shows the year photo first, then the
-- model's, then the brand's.
ALTER TABLE vehicle_generations ADD COLUMN IF NOT EXISTS photo_url TEXT;
