-- Catalog moderation: a rejected product keeps WHY it was rejected (the reasons the admin ticked, an optional note, and when),
-- so the supplier sees them in My Drafts (Not published) and can fix the product and send it back for review.
-- A rejected product keeps status 'inactive'; rejected_at is set while it waits for the supplier (cleared when approved or resubmitted).
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reasons text[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_note text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
CREATE INDEX IF NOT EXISTS products_rejected_idx ON products (supplier_id) WHERE rejected_at IS NOT NULL;
