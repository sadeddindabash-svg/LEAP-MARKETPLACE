-- Free shipping above a limit. The limit and the fee live in the generic platform_settings store (key 'free_shipping', set by the admin); an order keeps the shipping fee it was charged, so
-- changing the limit later never changes an order already placed. orders.total INCLUDES the fee (it is what the buyer pays); shipping_fee is the part of it that is shipping.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;
