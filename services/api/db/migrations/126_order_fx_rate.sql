-- Migration 126: each order keeps the yuan -> dollar rate of the day it was placed (fx_rates 'CNY_USD', the rate the pricing engine used for its prices),
-- so the Profits report (Financial -> Profits) works out what the suppliers cost in dollars at THAT rate, not today's. Set by the database itself when an
-- order is created, so no part of the checkout has to remember it. Orders placed before this migration have none: the report uses today's rate for them.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fx_cny_usd NUMERIC(14, 8);

CREATE OR REPLACE FUNCTION orders_keep_fx_rate() RETURNS trigger AS $$
BEGIN
  IF NEW.fx_cny_usd IS NULL THEN
    NEW.fx_cny_usd := (SELECT rate FROM fx_rates WHERE currency_pair = 'CNY_USD');
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_keep_fx_rate ON orders;
CREATE TRIGGER orders_keep_fx_rate BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION orders_keep_fx_rate();
