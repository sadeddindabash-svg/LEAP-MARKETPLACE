-- Migration 071: adds a real, single-row settings table for product
-- submission requirements, confirmed with the person directly: an
-- admin needs to configure how many photos are required, whether
-- photos and video are mandatory at all, and the max real video
-- duration -- rather than these being hardcoded constants only a
-- code change could adjust.
--
-- Deliberately a single, real singleton row (id fixed to 1, enforced
-- by the CHECK constraint) rather than a per-category or per-supplier
-- setting, since the person's own confirmed request was for one
-- global real configuration controlling every real product
-- submission, not scoped settings.

CREATE TABLE IF NOT EXISTS product_requirements (
  id                          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_photos                  INTEGER NOT NULL DEFAULT 4 CHECK (min_photos >= 1),
  photos_required             BOOLEAN NOT NULL DEFAULT true,
  video_required              BOOLEAN NOT NULL DEFAULT true,
  max_video_duration_seconds  INTEGER NOT NULL DEFAULT 8 CHECK (max_video_duration_seconds >= 1),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO product_requirements (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
