-- Migration 123: the currency the BUYER saw prices in when they placed the order, and the rate used (units of that currency per 1 US dollar).
-- Prices and totals stay in US dollars; the receipt shows the amounts in this currency at this rate, so a receipt never changes later when the
-- rate moves. NULL for an order placed before this (its receipt uses the buyer's current choice at today's rate) or in US dollars.
ALTER TABLE orders
  ADD COLUMN display_currency TEXT,
  ADD COLUMN display_rate NUMERIC(20, 8);
