-- Migration 023: real bulk product import for suppliers.
--
-- CONFIRMED SCOPE, discussed and refined over several rounds before
-- building: most suppliers keep a real spreadsheet for ONE specific
-- vehicle (brand/model/generation/year), with simple columns -- OE
-- Number, Item Name, Price -- not the full structured submission this
-- system otherwise requires. Confirmed design: the vehicle is picked
-- ONCE at upload time (not per row); the sheet's required columns are
-- just OE Number, Item Name, Price; Category/Part/Position/weight/
-- dimensions are OPTIONAL columns a supplier can fill in if they
-- already know them, used directly when they validate against real
-- reference data and simply left for later otherwise; photos are
-- NEVER in the spreadsheet (confirmed: a cell can't reliably hold an
-- extractable image, and embedding a single photo per row was
-- explicitly ruled out) -- every imported item still needs its real 3
-- required photos added afterward in the portal before it can be
-- submitted for the exact same real moderation review every product
-- already goes through.
--
-- This needs a genuinely new, distinct product status: a bulk-imported
-- item is not yet ready for moderation (may be missing category, part,
-- position, dimensions, and always missing all 3 required photos) --
-- 'draft' is real and distinct from 'translating' (already submitted,
-- awaiting real admin review) and 'active'/'inactive' (already
-- moderated).
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check CHECK (status IN ('draft', 'active', 'translating', 'inactive'));

-- A real draft may not have its category matched yet (part and
-- position were already nullable; category alone was NOT NULL since
-- every real product before this feature always required it upfront).
ALTER TABLE products ALTER COLUMN category DROP NOT NULL;
