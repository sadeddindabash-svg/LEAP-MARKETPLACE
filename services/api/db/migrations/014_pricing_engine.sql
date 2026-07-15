-- Migration 014: real pricing engine — supplier RMB cost -> buyer USD price
--
-- CONFIRMED BUSINESS DECISIONS, not assumed:
--   1. Suppliers price in RMB. `products.price`/`currency_code` (from
--      migration 001) are NOT renamed — same reasoning as name/name_en in
--      migration 012 — but their MEANING changes going forward: for any
--      product submitted after this migration, they represent the
--      supplier's RMB cost, not the buyer-facing price. Enforced in the
--      supplier submission endpoint (currencyCode must be 'CNY').
--   2. The buyer-facing USD price is DERIVED, never stored — computed
--      live by services/api/src/modules/pricing/engine.js every time a
--      buyer browses or views a product, so a fee/rate change is
--      reflected immediately everywhere. It is NOT recalculated after
--      an order is placed — the existing order_line_items.unit_price
--      column (migration 001) already snapshots whatever the computed
--      price was at that exact moment, which is the correct point to
--      lock it: a live-changing price between "buyer sees $50" and
--      "buyer's card gets charged" would be a real billing-integrity bug,
--      not a feature. No schema change was needed for this locking
--      behavior — it already existed for exactly this reason.
--   3. The exchange rate is meant to come from a real live-rate API —
--      not configured in this environment (same category of external
--      dependency as the payment gateways: no real API key available
--      here). `fx_rates` holds a REAL, FUNCTIONAL manually-set fallback
--      rate that the calculation actually uses today; see that module's
--      header comment for exactly how the two paths fit together.

-- Real, admin-managed fee variables. Every fee amount is RMB-denominated
-- and applied against a RUNNING TOTAL in `sort_order` sequence (a real
-- landed-cost buildup: cost -> + fee -> + next fee -> ..., where a
-- percentage fee is calculated against whatever the running total is at
-- THAT point, not always against the original cost) — this is standard
-- international-trade landed-cost practice, not an arbitrary choice.
CREATE TABLE IF NOT EXISTS pricing_fee_components (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('percentage', 'flat', 'shipping_volumetric')),
  -- percentage: value is percentage points (8.5 means 8.5%), applied to
  --   the running total.
  -- flat: value is a flat RMB amount added to the running total.
  -- shipping_volumetric: value is an RMB rate per chargeable kilogram —
  --   see the pricing engine for the real industry-standard volumetric-
  --   weight formula (max(actual weight, L*W*H/5000)) this is a
  --   deliberately simple placeholder for until a more sophisticated
  --   shipping equation is designed, per the explicit statement that
  --   this would be revisited later.
  value       NUMERIC(10, 4) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_fee_components_sort ON pricing_fee_components(sort_order);

-- One row per currency pair. Only CNY_USD is used today ("right now we
-- need USD only"), but the schema doesn't hardcode that assumption.
CREATE TABLE IF NOT EXISTS fx_rates (
  currency_pair  TEXT PRIMARY KEY, -- e.g. 'CNY_USD' -- 1 unit of the FIRST currency = `rate` units of the SECOND
  rate           NUMERIC(14, 8) NOT NULL,
  source         TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'live')),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
