-- Migration 124: "Get a quotation". A signed-in buyer turns parts from the cart into an official, numbered quotation for a named party (an
-- insurance company, a repair shop, the other party in an accident, an employer, anyone). Leap is the single issuer, even when the parts come
-- from several sellers. The prices are the ones the buyer saw at that moment and never change; each seller sets how long its prices hold
-- (suppliers.quote_validity_days, 7 days when not set) and the whole quotation expires on the earliest of its sellers' dates.
-- Anyone with the link can check it (the short code) and confirm their share; when every share is confirmed the quotation becomes a normal
-- order at the quoted prices. No money is collected online here, exactly as at checkout: each payer picks a payment method for their country.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS quote_validity_days INTEGER CHECK (quote_validity_days BETWEEN 1 AND 90);

CREATE SEQUENCE IF NOT EXISTS quotation_number_seq;

CREATE TABLE IF NOT EXISTS quotations (
  id               TEXT PRIMARY KEY,                                   -- Q-2026-000123
  code             TEXT NOT NULL UNIQUE,                                -- the short code on the PDF and in the link (7KQ2M9XA)
  buyer_id         TEXT NOT NULL REFERENCES users(id),
  party_type       TEXT NOT NULL CHECK (party_type IN ('insurance', 'repair_shop', 'other_party', 'employer', 'other')),
  party_name       TEXT NOT NULL,
  policy_number    TEXT,
  report_number    TEXT,                                                -- police / accident report number (Najm in Saudi Arabia, ...)
  vehicle          JSONB NOT NULL,                                      -- { make, model, year, vin?, plate? }
  address          JSONB NOT NULL,                                      -- where the order will be delivered: a copy, like an order's
  lang             TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'ar')),
  display_currency TEXT NOT NULL DEFAULT 'USD',
  display_rate     NUMERIC(20, 8) NOT NULL DEFAULT 1,                   -- units of display_currency per 1 US dollar, fixed at issue
  subtotal_usd     NUMERIC(12, 2) NOT NULL,
  shipping_usd     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_usd        NUMERIC(12, 2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ordered', 'cancelled')),
  expires_at       TIMESTAMPTZ NOT NULL,
  order_id         TEXT REFERENCES orders(id),
  renewed_from     TEXT REFERENCES quotations(id),
  open_count       INTEGER NOT NULL DEFAULT 0,                          -- how often the shared link was opened
  last_opened_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotations_buyer ON quotations(buyer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quotation_items (
  id             SERIAL PRIMARY KEY,
  quotation_id   TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id     TEXT NOT NULL REFERENCES products(id),
  supplier_id    TEXT REFERENCES suppliers(id),
  name           TEXT NOT NULL,
  name_ar        TEXT,
  oem_number     TEXT,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_usd NUMERIC(12, 2) NOT NULL,
  in_stock       BOOLEAN NOT NULL,                                     -- availability on the day it was issued
  valid_until    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

CREATE TABLE IF NOT EXISTS quotation_shares (
  id             SERIAL PRIMARY KEY,
  quotation_id   TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  payer          TEXT NOT NULL CHECK (payer IN ('party', 'buyer')),    -- the named party, or the buyer themselves
  percent        NUMERIC(5, 2) NOT NULL CHECK (percent > 0 AND percent <= 100),
  amount_usd     NUMERIC(12, 2) NOT NULL,
  confirmed_at   TIMESTAMPTZ,
  payer_name     TEXT,
  payer_email    TEXT,
  payer_phone    TEXT,
  payment_method TEXT,                                                 -- a payment_methods id, as chosen at checkout
  UNIQUE (quotation_id, payer)
);
