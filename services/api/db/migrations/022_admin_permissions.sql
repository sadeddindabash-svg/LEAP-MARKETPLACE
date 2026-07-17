-- Migration 022: real admin team permissions.
--
-- CONFIRMED SCOPE, discussed and 2 scenarios confirmed before building:
-- one real "owner" admin manages permissions for every other admin
-- account; page-level access control for now (can a given admin access
-- a given admin dashboard page, yes/no) -- finer view-vs-edit control
-- within a page is a real, deliberate future step, not built here.
--
-- Every admin-only endpoint before this migration just checked "is this
-- person AN admin, full stop" -- 47 real endpoints, no real distinction
-- between different kinds of admin staff. The users.role column already
-- had unused 'support'/'finance' values sitting in its CHECK constraint
-- since the very first migration, never actually wired to any real
-- permission difference -- this migration builds the real thing instead
-- of reviving those 2 dead, rigid labels.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- The real seeded dev admin becomes the real owner -- someone has to be
-- able to grant permissions to every other admin account that gets
-- created after this.
UPDATE users SET is_owner = true WHERE role = 'admin' AND email = 'admin@leap.dev';

-- Real, per-admin, per-page access. page_id values match the admin
-- dashboard's own real NAV page ids (see apps/admin-dashboard/src/App.jsx's
-- NAV array) -- 'overview', 'orders', 'suppliers', 'moderation',
-- 'returns', 'vehicleData', 'categories', 'supplierMessages',
-- 'promoCodes', 'hubs', 'pricing', 'flagged', 'payouts', 'tickets',
-- 'settings'. A real owner (users.is_owner = true) bypasses this table
-- entirely and always has full real access to every page -- this table
-- only matters for non-owner admin accounts.
CREATE TABLE IF NOT EXISTS admin_page_permissions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  PRIMARY KEY (user_id, page_id)
);
