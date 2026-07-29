-- Migration 047: real "default vehicle" for My Garage (BUY-004/010-012
-- follow-up). A buyer with more than one saved vehicle previously had
-- no way to say which one should drive automatic fitment filtering
-- (the home feed, "shop for my car") -- it silently used whichever
-- vehicle happened to be first in an arbitrary list order.
--
-- Confirmed by reading services/api/src/modules/garage/routes.js
-- directly, not assumed: the currently-used table is
-- user_saved_generations (migration 044), NOT user_saved_vehicles
-- (migration 008 -- already confirmed dead/unused, left in place
-- untouched by that same migration's own header comment).
--
-- Exactly one real default per buyer is enforced at the application
-- layer (see garage/routes.js), not a DB constraint -- unsetting the
-- previous default and setting the new one happens together in a
-- single real transaction.

ALTER TABLE user_saved_generations ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
