-- Migration 043: evidence photos on a return case (mirrors
-- product_review photos, migration 031, and hub_shipment_photos,
-- migration 011 -- same "at least one, enforced in application code,
-- not a DB constraint" pattern already used in both places).
--
-- DELIBERATE DESIGN: photos attach to the CASE itself, not to an
-- individual buyer/admin message. A buyer attaches evidence once, when
-- filing the return ("here's the damage") -- this isn't a per-message
-- photo-sharing chat, it's evidence for the dispute as a whole.
--
-- DELIBERATE ISOLATION, matching this migration's own file (007): these
-- photos are only ever exposed through the buyer<->admin surface
-- (GET /returns/my-cases/:id for the buyer, GET /returns/:id for admin)
-- -- never through GET /returns/supplier/me/:id. A supplier seeing the
-- buyer's own evidence photos directly would be the exact same
-- structural leak the two separate message-thread tables in migration
-- 007 exist to prevent; if a case's evidence is relevant to a supplier,
-- an admin relays that through the separate supplier thread instead.
CREATE TABLE IF NOT EXISTS return_case_photos (
  id          SERIAL PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES return_cases(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_return_case_photos_case ON return_case_photos(case_id);
