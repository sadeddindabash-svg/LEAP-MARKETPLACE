-- Migration 050: real search query logging, the foundation for
-- genuinely computed trending searches (see catalog/routes.js's own
-- real logging call and the new GET /catalog/trending-searches
-- endpoint).
--
-- CONFIRMED SCOPE: user_id is nullable -- a real guest can search
-- without an account, and their real search still contributes to
-- real trending aggregation even though it can't be tied to a real
-- person. No foreign key to `users` with ON DELETE CASCADE either --
-- a real deleted account's own past real searches should still count
-- toward real trending data, since the point is aggregate real
-- platform behavior, not a per-user history (My Garage's own recent-
-- searches feature already covers that separately, client-side).
CREATE TABLE IF NOT EXISTS search_log (
  id          SERIAL PRIMARY KEY,
  query       TEXT NOT NULL,
  user_id     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Real index for the real trending aggregation query's own real
-- WHERE created_at > ... clause -- this table is real, ongoing write
-- traffic (every qualifying real search), so a real read-side index
-- matters here, not just correctness.
CREATE INDEX IF NOT EXISTS idx_search_log_created_at ON search_log(created_at);
