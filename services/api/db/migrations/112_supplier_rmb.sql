-- The supplier portal works in RMB (yuan) only. A supplier is paid THEIR OWN RMB price x quantity (Leap's fees are inside the buyer's price), so each order line keeps the supplier's RMB price as it was when the order was placed.

-- 1. The supplier's RMB price, saved on the order line at the moment of ordering (a later price edit never changes an old order).
ALTER TABLE order_line_items ADD COLUMN IF NOT EXISTS supplier_unit_price_cny NUMERIC(12, 2);
-- Orders that already exist: the product's current RMB price (the best that can be known; a product that is not priced in RMB stays empty and is shown as "-").
UPDATE order_line_items oli SET supplier_unit_price_cny = p.price
  FROM products p WHERE p.id = oli.product_id AND p.currency_code = 'CNY' AND oli.supplier_unit_price_cny IS NULL;

-- 2. Payout adjustments (a fault Leap bears the cost of) were recorded in US dollars: they keep that currency; new ones are in RMB.
ALTER TABLE payout_adjustments ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE payout_adjustments ALTER COLUMN currency_code SET DEFAULT 'CNY';

-- 3. New payouts are recorded in RMB. Payouts already recorded in US dollars stay as they are (they cannot be converted exactly: no rate was saved).
ALTER TABLE payouts ALTER COLUMN currency_code SET DEFAULT 'CNY';
