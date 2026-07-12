-- Migration 001: initial schema
-- Covers the SRS data entities (Section 7.1) for the modules that currently
-- exist in services/api: catalog, fitment, cart, order, payment.
--
-- NOT yet covered (add in a future migration once those backend modules are
-- built — currently only mocked in the admin-dashboard/supplier-portal
-- prototypes, not real endpoints): commission/payout records, return/dispute
-- cases, reviews/ratings, support tickets. Adding tables for those now, ahead
-- of the endpoints that would use them, would just be unused schema.

CREATE TABLE IF NOT EXISTS suppliers (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  country             TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'admin', 'support', 'finance')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Year/Make/Model/Trim reference data (Phase 1 fitment — BUY-010).
CREATE TABLE IF NOT EXISTS vehicles (
  id          TEXT PRIMARY KEY,
  make        TEXT NOT NULL,
  model       TEXT NOT NULL,
  trim        TEXT NOT NULL,
  years_range TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id                       TEXT PRIMARY KEY,
  supplier_id              TEXT REFERENCES suppliers(id),
  name                     TEXT NOT NULL,
  category                 TEXT NOT NULL,
  price                    NUMERIC(12, 2) NOT NULL,
  currency_code            TEXT NOT NULL,
  stock_quantity           INTEGER NOT NULL DEFAULT 0,
  estimated_delivery_days  INTEGER NOT NULL DEFAULT 7,
  rating                   NUMERIC(2, 1),
  review_count             INTEGER NOT NULL DEFAULT 0,
  status                   TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'translating', 'inactive')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);

-- Many-to-many: which vehicles a product is confirmed to fit (BUY-013).
CREATE TABLE IF NOT EXISTS product_fitment (
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vehicle_id  TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, vehicle_id)
);
CREATE INDEX IF NOT EXISTS idx_fitment_vehicle ON product_fitment(vehicle_id);

CREATE TABLE IF NOT EXISTS carts (
  id          TEXT PRIMARY KEY,
  buyer_id    TEXT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_id     TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (cart_id, product_id)
);

-- A single buyer order (BUY-031: buyer sees one order + one total, even
-- though it splits into per-supplier sub-orders below).
CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY, -- e.g. 'LP-208841'
  buyer_id       TEXT REFERENCES users(id),
  guest_email    TEXT, -- set instead of buyer_id for guest checkout orders
  status         TEXT NOT NULL DEFAULT 'to_ship'
                 CHECK (status IN ('to_pay', 'to_ship', 'processing', 'shipped', 'to_review', 'delivered', 'dispute', 'returns')),
  total          NUMERIC(12, 2) NOT NULL,
  currency_code  TEXT NOT NULL,
  placed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT buyer_or_guest CHECK (buyer_id IS NOT NULL OR guest_email IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS supplier_sub_orders (
  id             SERIAL PRIMARY KEY,
  order_id       TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id    TEXT NOT NULL REFERENCES suppliers(id),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'preparing', 'shipped', 'delivered', 'dispute')),
  tracking_number TEXT
);
CREATE INDEX IF NOT EXISTS idx_sub_orders_order ON supplier_sub_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_sub_orders_supplier ON supplier_sub_orders(supplier_id);

CREATE TABLE IF NOT EXISTS order_line_items (
  id              SERIAL PRIMARY KEY,
  sub_order_id    INTEGER NOT NULL REFERENCES supplier_sub_orders(id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL REFERENCES products(id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC(12, 2) NOT NULL
);

-- Records every payment attempt across all gateways (Stripe, APS, PayPal) —
-- ties a gateway-specific reference back to our order, independent of which
-- provider handled it.
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                 SERIAL PRIMARY KEY,
  order_id           TEXT REFERENCES orders(id),
  provider           TEXT NOT NULL CHECK (provider IN ('stripe', 'amazon_payment_services', 'paypal', 'google_pay')),
  gateway_reference   TEXT, -- Stripe intent id / APS merchant_reference / PayPal order id
  amount             NUMERIC(12, 2) NOT NULL,
  currency_code      TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_tx_order ON payment_transactions(order_id);
