-- Parts from a quotation (the buyer's "Order these parts"): the basket remembers which quotation each part came from, so it can group them under the
-- quotation, and the order keeps the link (shown on the order). Null: a part from the catalogue. A quotation removed later just drops the link.
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS quotation_id TEXT REFERENCES quotations(id) ON DELETE SET NULL;
ALTER TABLE order_line_items ADD COLUMN IF NOT EXISTS quotation_id TEXT REFERENCES quotations(id) ON DELETE SET NULL;
