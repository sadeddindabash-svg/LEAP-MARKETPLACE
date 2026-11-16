-- Delivery Rules give the shipping PRICE too (patch-delivery-prices, confirmed with the person via mockup):
--   every rule: a default price for all countries (RMB per chargeable kg) and chosen countries with their own price AND their own delivery days;
--   when no rule fits: a general price (RMB per kg); a minimum per item; the chargeable-weight divisor (air freight 5000).
-- Pricing > Fee components: the fixed "RMB per kg" shipping line becomes "Shipping from Delivery Rules" (type shipping_rules).
-- On install, today's shipping rate is copied into every rule and into the general price, so no buyer price changes until the admin changes it.
ALTER TABLE delivery_rules ADD COLUMN IF NOT EXISTS price_cny_per_kg NUMERIC(10, 2);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_rules_price_range') THEN
    ALTER TABLE delivery_rules ADD CONSTRAINT delivery_rules_price_range CHECK (price_cny_per_kg IS NULL OR (price_cny_per_kg > 0 AND price_cny_per_kg <= 10000));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS delivery_rule_country_prices (
  rule_id           TEXT NOT NULL REFERENCES delivery_rules(id) ON DELETE CASCADE,
  iso_code          TEXT NOT NULL,
  price_cny_per_kg  NUMERIC(10, 2) NOT NULL,
  delivery_days     INTEGER NOT NULL,
  PRIMARY KEY (rule_id, iso_code)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_rule_country_prices_ranges') THEN
    ALTER TABLE delivery_rule_country_prices ADD CONSTRAINT delivery_rule_country_prices_ranges CHECK (price_cny_per_kg > 0 AND price_cny_per_kg <= 10000 AND delivery_days BETWEEN 1 AND 120);
  END IF;
END $$;

ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS fallback_price_cny_per_kg NUMERIC(10, 2);
ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS min_shipping_cny NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS volumetric_divisor INTEGER NOT NULL DEFAULT 5000;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_settings_shipping_ranges') THEN
    ALTER TABLE delivery_settings ADD CONSTRAINT delivery_settings_shipping_ranges CHECK (
      (fallback_price_cny_per_kg IS NULL OR (fallback_price_cny_per_kg > 0 AND fallback_price_cny_per_kg <= 10000))
      AND min_shipping_cny BETWEEN 0 AND 300 AND volumetric_divisor BETWEEN 4000 AND 6000);
  END IF;
END $$;

-- the new fee type
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_fee_components_type_check') THEN
    ALTER TABLE pricing_fee_components DROP CONSTRAINT pricing_fee_components_type_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_fee_components_type_choices') THEN
    ALTER TABLE pricing_fee_components ADD CONSTRAINT pricing_fee_components_type_choices CHECK (type IN ('percentage', 'flat', 'shipping_volumetric', 'shipping_rules'));
  END IF;
END $$;

-- copy today's rate (the first active fixed shipping line) into the rules and the general price, then switch that line to the rules (runs once: afterwards
-- there is no shipping_volumetric line left to copy from)
INSERT INTO delivery_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
DO $$
DECLARE rate NUMERIC;
BEGIN
  SELECT value INTO rate FROM pricing_fee_components WHERE type = 'shipping_volumetric' AND is_active = true AND value > 0 ORDER BY sort_order LIMIT 1;
  IF rate IS NOT NULL THEN
    rate := LEAST(GREATEST(ROUND(rate, 2), 0.01), 10000);
    UPDATE delivery_rules SET price_cny_per_kg = rate WHERE price_cny_per_kg IS NULL;
    UPDATE delivery_settings SET fallback_price_cny_per_kg = rate WHERE id = 1 AND fallback_price_cny_per_kg IS NULL;
    UPDATE pricing_fee_components SET type = 'shipping_rules', updated_at = now() WHERE type = 'shipping_volumetric';
  END IF;
END $$;
