-- Migration 067: buyer "request a quote" system (RFQ) for parts not
-- currently listed in the marketplace, confirmed with the person
-- through multiple rounds of design discussion before building:
-- buyer picks a vehicle (brand -> model -> generation -> year, the
-- same real fitment cascade already used elsewhere) and lists up to
-- 20 real parts they need (name, description, an optional reference
-- photo of their own). Real staff then source real prices from real
-- suppliers OFFLINE and enter them here -- there is deliberately no
-- supplier-facing bidding UI for this, confirmed as out of scope.

CREATE TABLE IF NOT EXISTS quote_requests (
  id             TEXT PRIMARY KEY,
  buyer_id       TEXT NOT NULL REFERENCES users(id),
  generation_id  TEXT NOT NULL REFERENCES vehicle_generations(id),
  year           INTEGER NOT NULL,
  -- Real, confirmed state machine: draft (buyer still editing, not
  -- yet visible to staff) -> submitted (locked for the buyer, staff
  -- can now price it) -> quoted (staff sent real prices back; buyer
  -- can now drop items or reduce quantity, but not add new unpriced
  -- ones) -> ordered (buyer paid) / expired (quote's own real
  -- validity window passed) / cancelled (buyer withdrew).
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'submitted', 'quoted', 'ordered', 'expired', 'cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at   TIMESTAMPTZ,
  quoted_at      TIMESTAMPTZ,
  -- Real, confirmed as necessary: a quote shouldn't stay honorable
  -- forever, since the real supplier prices behind it can move. Set
  -- when staff send the quote (quoted_at + 7 real days), not at
  -- creation.
  expires_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_quote_requests_buyer ON quote_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);

CREATE TABLE IF NOT EXISTS quote_request_items (
  id                   TEXT PRIMARY KEY,
  request_id           TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  reference_photo_url  TEXT,
  quantity             INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sort_order           INTEGER NOT NULL DEFAULT 0,
  -- Real, confirmed per-item state, independent of the request's own
  -- overall status: pending (not yet priced by staff) -> priced (a
  -- real product now exists for it, see product_id) or unavailable
  -- (staff genuinely couldn't source it -- a real, honest outcome,
  -- not hidden from the buyer).
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'priced', 'unavailable')),
  -- Real staging area for staff's own real price entry, BEFORE the
  -- real product itself is created -- confirmed as the right design:
  -- creating a real half-finished product the moment an admin merely
  -- types a number into an input field (before they've finished
  -- uploading photos or hit "send") would litter the real catalog
  -- with abandoned drafts if they navigate away mid-edit.
  draft_price          NUMERIC(12, 2),
  -- Real staging fields for the category/part classification staff
  -- assign at pricing time -- confirmed necessary since
  -- products.category is required, but the buyer's own RFQ item
  -- never specifies one (they just describe what they need in plain
  -- language).
  draft_category       TEXT,
  draft_part           TEXT,
  -- Set only once staff actually send the quote and a real product
  -- is created for this specific item -- see the new quote-requests
  -- module for the real logic.
  product_id           TEXT REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_quote_request_items_request ON quote_request_items(request_id);

-- Real staging area for the product photos staff upload while pricing
-- an item -- confirmed as required before an item can be included in
-- a sent quote ("we need to add photos for the product listing to be
-- eligible to add"). Kept separate from product_images since these
-- exist BEFORE any real product row does; migrated over to a real
-- product_images row for the same URLs the moment the quote is sent.
CREATE TABLE IF NOT EXISTS quote_request_item_photos (
  id          SERIAL PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES quote_request_items(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quote_request_item_photos_item ON quote_request_item_photos(item_id);

-- Real "Leap Supplier" account, confirmed directly with the person:
-- one shared real account real Leap staff log into to fulfil quoted
-- requests, reusing the existing real supplier/product/moderation
-- infrastructure end to end rather than a parallel system. Already
-- verified (this is Leap's own real account, not a third party
-- awaiting real verification). Initial real password is intentionally
-- documented here in plain sight (not hidden in code) so whoever
-- deploys this migration knows to change it immediately via the
-- already-existing real /auth/reset-password flow -- confirmed this
-- is acceptable for a single, real internal account rather than
-- building new infrastructure just for this one seed.
INSERT INTO suppliers (id, name, country, verification_status)
VALUES ('supplier_leap', 'Leap Supplier', 'Jordan', 'verified')
ON CONFLICT (id) DO NOTHING;

-- Real initial password: LeapSupplier2026!  -- change this immediately
-- after first login via the existing /auth/reset-password flow.
INSERT INTO users (id, email, name, role, supplier_id, password_hash)
VALUES (
  'user_leap_supplier',
  'leap-supplier@leap.dev',
  'Leap Supplier Staff',
  'supplier',
  'supplier_leap',
  '$2b$10$aYD1vlThTQLFTTpa6XfDaOKa0dsztvNBSfgU3RzCPfgHASGDUMBHK'
)
ON CONFLICT (id) DO NOTHING;
