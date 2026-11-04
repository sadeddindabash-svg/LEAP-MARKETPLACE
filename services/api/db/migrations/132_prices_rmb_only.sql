-- Migration 132: every product price is in RMB (yuan), and only RMB from now on (confirmed with the person).
-- Products still marked in another currency (older products, from before suppliers priced in RMB only) keep their number, relabelled as yuan:
-- the person confirmed those numbers were yuan.
UPDATE products SET currency_code = 'CNY' WHERE currency_code IS DISTINCT FROM 'CNY';

-- Order lines that had no supplier RMB price because their product was not in RMB: the product's price, now in yuan (the supplier portal's order
-- details, payouts and profits read it).
UPDATE order_line_items oli SET supplier_unit_price_cny = ROUND(p.price::numeric, 2)
  FROM products p
  WHERE p.id = oli.product_id AND oli.supplier_unit_price_cny IS NULL AND p.price IS NOT NULL AND p.price >= 0;

-- And never anything else: the database itself refuses a product price in any other currency.
ALTER TABLE products ALTER COLUMN currency_code SET DEFAULT 'CNY';
ALTER TABLE products ALTER COLUMN currency_code SET NOT NULL;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_rmb_only;
ALTER TABLE products ADD CONSTRAINT products_price_rmb_only CHECK (currency_code = 'CNY');
