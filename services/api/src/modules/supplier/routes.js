const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { createNotification } = require('../notifications/helpers');
const { validateFitment, tryMatchCategoryAndPart, tryMatchPosition, tryMatchDimensions, validateCompleteFields } = require('./productValidation');

/**
 * Supplier module — SUP-001–003 (onboarding/verification) from the
 * supplier's own side; this is the ADMIN-facing view (ADM-001: review,
 * approve, reject supplier accounts).
 *
 * Admin-only: both routes require an authenticated admin. There is no
 * supplier-facing login/session yet (see the Supplier Portal prototype) —
 * this module only covers the platform-admin half of supplier management.
 */
const router = express.Router();

function toSupplierDto(row) {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    contactEmail: row.contact_email,
    verificationStatus: row.verification_status,
    listingCount: Number(row.listing_count) || 0,
    createdAt: row.created_at,
  };
}

// GET /supplier — admin only. Listing count is derived via a live join
// against products rather than stored, so it's never stale.
router.get('/', requireAuth, requireRole('admin'), requirePageAccess('suppliers'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, COUNT(p.id) AS listing_count
      FROM suppliers s
      LEFT JOIN products p ON p.supplier_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    res.json(rows.map(toSupplierDto));
  } catch (err) {
    next(err);
  }
});

// PATCH /supplier/:id/verify  { status: 'verified' | 'rejected' }
router.patch('/:id/verify', requireAuth, requireRole('admin'), requirePageAccess('suppliers'), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "status must be 'verified' or 'rejected'" });
    }
    const { rows } = await db.query(
      `UPDATE suppliers SET verification_status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    // Note: listingCount is intentionally omitted here (not re-joined) —
    // the client already has it from the list view and this response is
    // just confirming the status change, not a full record refresh.
    const { id, name, country, contact_email, verification_status, created_at } = rows[0];
    res.json({ id, name, country, contactEmail: contact_email, verificationStatus: verification_status, createdAt: created_at });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Supplier-facing endpoints (the actual Supplier Portal) — SUP-001–022.
// Everything below requires role='supplier' and scopes to req.user.supplierId
// (from the JWT — see auth/middleware.js signToken). A supplier can only
// ever see/modify their OWN products and order fulfillment, never another
// supplier's — enforced with a WHERE clause on every query below, not just
// a UI assumption.
// ============================================================

function toProductDto(row) {
  return {
    id: row.id,
    name: row.name,
    nameZh: row.name_zh,
    description: row.description,
    descriptionZh: row.description_zh,
    category: row.category,
    part: row.part,
    position: row.position,
    oemNumber: row.oem_number,
    price: Number(row.price),
    currencyCode: row.currency_code,
    stockQuantity: row.stock_quantity,
    estimatedDeliveryDays: row.estimated_delivery_days,
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    lengthCm: row.length_cm === null ? null : Number(row.length_cm),
    widthCm: row.width_cm === null ? null : Number(row.width_cm),
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
    status: row.status,
    createdAt: row.created_at,
  };
}

// Attaches images and fitment entries to an already-built product DTO —
// separate queries since they're separate tables (product_images,
// product_fitment_entries), not columns on `products` itself.
async function attachImagesAndFitment(dto) {
  const [imagesRes, fitmentRes] = await Promise.all([
    db.query('SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order', [dto.id]),
    db.query(
      `SELECT pfe.year, pfe.engine_id, pfe.transmission_id, vg.id AS generation_id, vg.name AS generation_name,
              vm.name AS model_name, vb.name AS brand_name, ve.name AS engine_name, vt.name AS transmission_name
       FROM product_fitment_entries pfe
       JOIN vehicle_generations vg ON vg.id = pfe.generation_id
       JOIN vehicle_models vm ON vm.id = vg.model_id
       JOIN vehicle_brands vb ON vb.id = vm.brand_id
       LEFT JOIN vehicle_engines ve ON ve.id = pfe.engine_id
       LEFT JOIN vehicle_transmissions vt ON vt.id = pfe.transmission_id
       WHERE pfe.product_id = $1`,
      [dto.id]
    ),
  ]);
  return {
    ...dto,
    images: imagesRes.rows.map((r) => r.url),
    fitment: fitmentRes.rows.map((r) => ({
      brand: r.brand_name,
      model: r.model_name,
      generation: r.generation_name,
      year: r.year,
      engine: r.engine_name,
      transmission: r.transmission_name,
    })),
  };
}

// GET /supplier/me — own supplier profile.
router.get('/me', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.user.supplierId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json(toSupplierDto({ ...rows[0], listing_count: 0 }));
  } catch (err) {
    next(err);
  }
});

// GET /supplier/me/products — only this supplier's own products.
router.get('/me/products', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM products WHERE supplier_id = $1 ORDER BY created_at DESC', [req.user.supplierId]);
    const dtos = await Promise.all(rows.map((r) => attachImagesAndFitment(toProductDto(r))));
    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

// POST /supplier/me/products — manual add (SUP-010). New listings start
// as 'translating' (awaiting admin review, see catalog moderation-queue),
// NOT 'active' — a supplier cannot make their own product live to buyers
// without going through moderation first.
//
// Category and Part are now REAL, admin-managed reference data
// (migration 015, product_categories / category_parts) — a supplier
// picks a real Part from a real list scoped to the Category they
// selected, per the confirmed requirement, rather than typing free
// text. Validated against the database below, not a hardcoded array.
// A fixed, real list rather than free text — "Position" in the SRS
// cascade (Brand -> ... -> Category -> Part -> Position -> OEM Number)
// means where on the vehicle the part sits, not a free-form description.
const ALLOWED_POSITIONS = ['Front', 'Rear', 'Left', 'Right', 'Front-Left', 'Front-Right', 'Rear-Left', 'Rear-Right', 'Universal'];
const MIN_PRODUCT_PHOTOS = 3;

router.post('/me/products', requireAuth, requireRole('supplier'), async (req, res, next) => {
  const {
    nameZh, descriptionZh, category, part, position, oemNumber,
    price, currencyCode, stockQuantity, estimatedDeliveryDays,
    fitment, images, weightKg, lengthCm, widthCm, heightCm,
  } = req.body || {};

  // ---- Validation (fail loudly and specifically, not with one generic message) ----
  const missing = [];
  if (!nameZh) missing.push('nameZh');
  if (!category) missing.push('category');
  if (!part) missing.push('part');
  if (!position) missing.push('position');
  if (!oemNumber) missing.push('oemNumber');
  if (!price) missing.push('price');
  if (!currencyCode) missing.push('currencyCode');
  if (!fitment) missing.push('fitment');
  // Mandatory going forward, real numbers not free text — see migration
  // 013's header comment: these will feed a real shipping-fee
  // calculation in the admin dashboard, which needs actual operable
  // numbers, not "about 2kg" as a string.
  if (weightKg === undefined || weightKg === null) missing.push('weightKg');
  if (lengthCm === undefined || lengthCm === null) missing.push('lengthCm');
  if (widthCm === undefined || widthCm === null) missing.push('widthCm');
  if (heightCm === undefined || heightCm === null) missing.push('heightCm');
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
  }
  if (weightKg !== undefined && weightKg !== null && weightKg <= 0) {
    return res.status(400).json({ error: 'weightKg must be a positive number' });
  }
  for (const [field, value] of [['lengthCm', lengthCm], ['widthCm', widthCm], ['heightCm', heightCm]]) {
    if (value !== undefined && value !== null && value <= 0) {
      return res.status(400).json({ error: `${field} must be a positive number` });
    }
  }
  const categoryCheck = await db.query('SELECT id FROM product_categories WHERE id = $1', [category]);
  if (categoryCheck.rows.length === 0) {
    const { rows: allCategories } = await db.query('SELECT id FROM product_categories ORDER BY sort_order ASC');
    return res.status(400).json({ error: `category must be one of: ${allCategories.map((c) => c.id).join(', ')}` });
  }
  // Real, scoped validation: the part must be a real one that belongs
  // to THIS category specifically (matching by name, since
  // products.part stays plain text — see this file's header comment
  // and migration 015's for why) — a part from a different category
  // isn't accepted even if its name happens to be right.
  const partCheck = await db.query('SELECT id FROM category_parts WHERE category_id = $1 AND name_en = $2', [category, part]);
  if (partCheck.rows.length === 0) {
    const { rows: allParts } = await db.query('SELECT name_en FROM category_parts WHERE category_id = $1 ORDER BY sort_order ASC', [category]);
    return res.status(400).json({ error: `part must be one of: ${allParts.map((p) => p.name_en).join(', ')}` });
  }
  if (!ALLOWED_POSITIONS.includes(position)) {
    return res.status(400).json({ error: `position must be one of: ${ALLOWED_POSITIONS.join(', ')}` });
  }
  // CONFIRMED: suppliers price in RMB. The buyer-facing USD price is
  // computed live from this cost by the pricing engine (see
  // services/api/src/modules/pricing/engine.js) — never entered
  // directly. Locking this here rather than just documenting it,
  // because a stray non-RMB submission would silently corrupt the
  // pricing equation (treating, say, a USD amount as if it were RMB).
  if (currencyCode !== 'CNY') {
    return res.status(400).json({ error: "currencyCode must be 'CNY' — suppliers price in RMB; the buyer-facing USD price is computed automatically" });
  }
  if (!Array.isArray(images) || images.length < MIN_PRODUCT_PHOTOS) {
    return res.status(400).json({ error: `At least ${MIN_PRODUCT_PHOTOS} product photos are required (got ${Array.isArray(images) ? images.length : 0}). Upload via POST /uploads/product-image first.` });
  }
  const { generationId, year, engineId, transmissionId } = fitment;
  if (!generationId || !year) {
    return res.status(400).json({ error: 'fitment.generationId and fitment.year are required' });
  }

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // ---- Fitment validation against the real reference cascade ----
    const genCheck = await client.query('SELECT * FROM vehicle_generations WHERE id = $1', [generationId]);
    if (genCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Unknown fitment.generationId' });
    }
    const generation = genCheck.rows[0];
    const maxYear = generation.year_end || new Date().getFullYear() + 1;
    if (year < generation.year_start || year > maxYear) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `fitment.year ${year} is outside this generation's range (${generation.year_start}–${generation.year_end || 'present'})` });
    }
    if (engineId) {
      const engCheck = await client.query('SELECT id FROM vehicle_engines WHERE id = $1 AND generation_id = $2', [engineId, generationId]);
      if (engCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'fitment.engineId does not belong to the given generation' });
      }
    }
    if (transmissionId) {
      const transCheck = await client.query('SELECT id FROM vehicle_transmissions WHERE id = $1 AND generation_id = $2', [transmissionId, generationId]);
      if (transCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'fitment.transmissionId does not belong to the given generation' });
      }
    }

    // ---- Create the product. `name` starts equal to the Chinese
    // original (shown as-is until an admin approves a real translation
    // — see PATCH /catalog/products/:id/moderate in the catalog module),
    // not left NULL, since `name` is NOT NULL and real marketplaces
    // commonly show the untranslated original in the interim rather than
    // a blank placeholder. ----
    const id = `p_${Date.now()}`;
    await client.query(
      `INSERT INTO products
         (id, supplier_id, name, name_zh, description, description_zh, category, part, position, oem_number,
          price, currency_code, stock_quantity, estimated_delivery_days, status,
          weight_kg, length_cm, width_cm, height_cm)
       VALUES ($1, $2, $3, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'translating', $13, $14, $15, $16)`,
      [id, req.user.supplierId, nameZh, descriptionZh || null, category, part, position, oemNumber,
        price, currencyCode, stockQuantity || 0, estimatedDeliveryDays || 7,
        weightKg, lengthCm, widthCm, heightCm]
    );

    await client.query(
      `INSERT INTO product_fitment_entries (product_id, generation_id, year, engine_id, transmission_id) VALUES ($1, $2, $3, $4, $5)`,
      [id, generationId, year, engineId || null, transmissionId || null]
    );

    for (let i = 0; i < images.length; i++) {
      await client.query('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)', [id, images[i], i]);
    }

    await client.query('COMMIT');
    const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    res.status(201).json(await attachImagesAndFitment(toProductDto(rows[0])));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ============================================================
// Real bulk product import (migration 023). CONFIRMED SCOPE, refined
// over several rounds before building: most suppliers keep a real
// spreadsheet for ONE vehicle, with simple columns (OE Number, Item
// Name, Price) — not the full structured single-item submission above.
// The vehicle is picked ONCE for the whole batch; Category/Part/
// Position/dimensions are OPTIONAL per row, used directly when they
// validate and simply left for later otherwise; photos are NEVER in
// the sheet — every item still needs its real 3 required photos added
// afterward before it can be submitted for the same real moderation
// review every product goes through.
// ============================================================

const MAX_BULK_IMPORT_ITEMS = 200;

// POST /me/products/bulk-import — real, best-effort per item (same
// pattern as the admin dashboard's bulk moderation): one item missing
// its real required OE Number/Item Name/Price shouldn't cost the rest
// of a supplier's real batch.
router.post('/me/products/bulk-import', requireAuth, requireRole('supplier'), async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    const { fitment, nameLanguage, items } = req.body || {};
    if (!fitment) {
      return res.status(400).json({ error: 'fitment is required' });
    }
    if (!['zh', 'en'].includes(nameLanguage)) {
      return res.status(400).json({ error: "nameLanguage must be 'zh' or 'en'" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }
    if (items.length > MAX_BULK_IMPORT_ITEMS) {
      return res.status(400).json({ error: `Cannot import more than ${MAX_BULK_IMPORT_ITEMS} items in a single batch` });
    }

    // The real vehicle is shared by the whole batch — validated ONCE,
    // not per item.
    const fitmentResult = await validateFitment(fitment, client);
    if (!fitmentResult.valid) {
      return res.status(400).json({ error: fitmentResult.error });
    }
    const { generationId, year, engineId, transmissionId } = fitment;

    const results = [];
    await client.query('BEGIN');
    for (let i = 0; i < items.length; i++) {
      const item = items[i] || {};
      const { oemNumber, itemName, price } = item;
      if (!oemNumber || !itemName || price === undefined || price === null || price <= 0) {
        results.push({ index: i, success: false, error: 'oemNumber, itemName, and a positive price are all required' });
        continue;
      }

      const { category, part } = await tryMatchCategoryAndPart(item.category, item.part, client);
      const position = tryMatchPosition(item.position);
      const dims = tryMatchDimensions(item);

      const id = `p_${Date.now()}_${i}`;
      await client.query(
        `INSERT INTO products
           (id, supplier_id, name, name_zh, category, part, position, oem_number,
            price, currency_code, status, weight_kg, length_cm, width_cm, height_cm)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CNY', 'draft', $10, $11, $12, $13)`,
        [
          id, req.user.supplierId, itemName, nameLanguage === 'zh' ? itemName : null,
          category, part, position, oemNumber, price,
          dims.weightKg, dims.lengthCm, dims.widthCm, dims.heightCm,
        ]
      );
      await client.query(
        `INSERT INTO product_fitment_entries (product_id, generation_id, year, engine_id, transmission_id) VALUES ($1, $2, $3, $4, $5)`,
        [id, generationId, year, engineId || null, transmissionId || null]
      );
      results.push({ index: i, success: true, productId: id });
    }
    await client.query('COMMIT');

    res.status(201).json({ results });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /me/products/drafts — this supplier's own real bulk-imported
// drafts still needing completion before they can be submitted for
// real moderation. Reports exactly what's still missing per item so
// the portal can show a real, specific "needs: photos, category" state
// rather than a generic "incomplete."
router.get('/me/products/drafts', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, COALESCE(img.count, 0) AS photo_count
       FROM products p
       LEFT JOIN (SELECT product_id, COUNT(*) AS count FROM product_images GROUP BY product_id) img ON img.product_id = p.id
       WHERE p.supplier_id = $1 AND p.status = 'draft'
       ORDER BY p.created_at DESC`,
      [req.user.supplierId]
    );
    const dtos = await Promise.all(rows.map(async (row) => {
      const dto = await attachImagesAndFitment(toProductDto(row));
      const missing = [];
      if (!row.category) missing.push('category');
      if (!row.part) missing.push('part');
      if (!row.position) missing.push('position');
      if (row.weight_kg === null) missing.push('dimensions');
      if (Number(row.photo_count) < MIN_PRODUCT_PHOTOS) missing.push('photos');
      return { ...dto, missing };
    }));
    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

// PATCH /me/products/:id/complete — the real finishing step: fills in
// whichever of category/part/position/dimensions weren't already set
// (or overrides them), requires the real 3 photos, and — only once
// every real requirement is met — moves the draft into 'translating',
// entering the exact same real moderation queue every product goes
// through. Real ownership enforced via the WHERE clause, and only a
// genuine draft can be completed (an already-submitted product can't
// be re-completed through this endpoint).
router.patch('/me/products/:id/complete', requireAuth, requireRole('supplier'), async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    const draftCheck = await client.query(
      `SELECT * FROM products WHERE id = $1 AND supplier_id = $2 AND status = 'draft'`,
      [req.params.id, req.user.supplierId]
    );
    if (draftCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Draft product not found' });
    }
    const draft = draftCheck.rows[0];

    const category = req.body.category || draft.category;
    const part = req.body.part || draft.part;
    const position = req.body.position || draft.position;
    const weightKg = req.body.weightKg ?? (draft.weight_kg === null ? null : Number(draft.weight_kg));
    const lengthCm = req.body.lengthCm ?? (draft.length_cm === null ? null : Number(draft.length_cm));
    const widthCm = req.body.widthCm ?? (draft.width_cm === null ? null : Number(draft.width_cm));
    const heightCm = req.body.heightCm ?? (draft.height_cm === null ? null : Number(draft.height_cm));
    const images = req.body.images;

    if (category && category !== draft.category) {
      const { category: matchedCategory } = await tryMatchCategoryAndPart(category, null, client);
      if (!matchedCategory) {
        return res.status(400).json({ error: 'Unknown category' });
      }
    }
    if (part && category) {
      const { part: matchedPart } = await tryMatchCategoryAndPart(category, part, client);
      if (!matchedPart) {
        return res.status(400).json({ error: 'part must be a real part belonging to the given category' });
      }
    }

    const validation = validateCompleteFields({ category, part, position, weightKg, lengthCm, widthCm, heightCm, images });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    await client.query('BEGIN');
    await client.query(
      `UPDATE products SET
         category = $1, part = $2, position = $3, weight_kg = $4, length_cm = $5, width_cm = $6, height_cm = $7,
         status = 'translating'
       WHERE id = $8`,
      [category, part, position, weightKg, lengthCm, widthCm, heightCm, req.params.id]
    );
    await client.query('DELETE FROM product_images WHERE product_id = $1', [req.params.id]);
    for (let i = 0; i < images.length; i++) {
      await client.query('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)', [req.params.id, images[i], i]);
    }
    await client.query('COMMIT');

    const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    res.json(await attachImagesAndFitment(toProductDto(rows[0])));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /supplier/me/products/:id — edit price/stock. Ownership enforced
// via the WHERE clause (supplier_id = $N), not just a lookup-then-check —
// an UPDATE that matches zero rows because it belongs to someone else
// looks identical to "not found", which is the correct thing to leak here.
router.patch('/me/products/:id', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { price, stockQuantity } = req.body || {};
    if (price === undefined && stockQuantity === undefined) {
      return res.status(400).json({ error: 'Provide at least one of: price, stockQuantity' });
    }
    const { rows } = await db.query(
      `UPDATE products SET
         price = COALESCE($1, price),
         stock_quantity = COALESCE($2, stock_quantity)
       WHERE id = $3 AND supplier_id = $4
       RETURNING *`,
      [price ?? null, stockQuantity ?? null, req.params.id, req.user.supplierId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(await attachImagesAndFitment(toProductDto(rows[0])));
  } catch (err) {
    next(err);
  }
});

// GET /supplier/me/orders — this supplier's sub-orders only (SUP-020),
// with the buyer never exposed beyond what's needed to ship (no direct
// buyer contact — all communication routes through the Platform).
router.get('/me/orders', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows: subOrders } = await db.query(
      `SELECT so.id, so.order_id, so.status, so.tracking_number, so.hub_id, h.name AS hub_name, o.placed_at
       FROM supplier_sub_orders so
       JOIN orders o ON o.id = so.order_id
       LEFT JOIN hubs h ON h.id = so.hub_id
       WHERE so.supplier_id = $1
       ORDER BY o.placed_at DESC`,
      [req.user.supplierId]
    );

    const result = [];
    for (const so of subOrders) {
      const { rows: items } = await db.query(
        `SELECT oli.product_id, oli.quantity, oli.unit_price, p.name
         FROM order_line_items oli JOIN products p ON p.id = oli.product_id
         WHERE oli.sub_order_id = $1`,
        [so.id]
      );
      result.push({
        subOrderId: so.id,
        orderId: so.order_id,
        status: so.status,
        trackingNumber: so.tracking_number,
        hubId: so.hub_id,
        hubName: so.hub_name,
        placedAt: so.placed_at,
        items: items.map((i) => ({ productId: i.product_id, name: i.name, quantity: i.quantity, unitPrice: Number(i.unit_price) })),
      });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /supplier/me/orders/:subOrderId  { status?, trackingNumber? }
// (SUP-021/022: accept/prepare/ship + tracking). Ownership enforced the
// same way as the product PATCH above.
// PATCH /supplier/me/orders/:subOrderId  { status?, trackingNumber? }
// (SUP-021/022: accept/prepare/ship + tracking).
//
// IMPORTANT MEANING CHANGE (migration 011): 'shipped' here now means
// "shipped to the assigned HUB", NOT "shipped to the buyer" — every
// order now routes Supplier -> Hub -> Buyer, never supplier direct to
// buyer (see services/api/README.md's Inspection Hubs section). A
// supplier CANNOT mark a sub-order 'shipped' until an admin has
// assigned a hub to it (PATCH /hub/assign/:subOrderId) — enforced here,
// not just a UI nicety. The moment a sub-order transitions to 'shipped',
// its hub_shipments row is created automatically (status
// 'awaiting_receipt') — that's the bridge from the supplier's leg to
// the hub's leg of the journey.
router.patch('/me/orders/:subOrderId', requireAuth, requireRole('supplier'), async (req, res, next) => {
  const { status, trackingNumber } = req.body || {};
  if (status !== undefined && !['pending', 'preparing', 'shipped', 'delivered', 'dispute'].includes(status)) {
    return res.status(400).json({ error: "status must be one of: pending, preparing, shipped, delivered, dispute" });
  }
  if (status === undefined && trackingNumber === undefined) {
    return res.status(400).json({ error: 'Provide at least one of: status, trackingNumber' });
  }

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    if (status === 'shipped') {
      const ownCheck = await client.query('SELECT hub_id FROM supplier_sub_orders WHERE id = $1 AND supplier_id = $2', [req.params.subOrderId, req.user.supplierId]);
      if (ownCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Sub-order not found' });
      }
      if (!ownCheck.rows[0].hub_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This sub-order has no inspection hub assigned yet — an admin must assign one before it can be marked shipped.' });
      }
    }

    const { rows } = await client.query(
      `UPDATE supplier_sub_orders SET
         status = COALESCE($1, status),
         tracking_number = COALESCE($2, tracking_number)
       WHERE id = $3 AND supplier_id = $4
       RETURNING *`,
      [status ?? null, trackingNumber ?? null, req.params.subOrderId, req.user.supplierId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sub-order not found' });
    }

    if (status === 'shipped') {
      await client.query(
        `INSERT INTO hub_shipments (sub_order_id, hub_id) VALUES ($1, $2) ON CONFLICT (sub_order_id) DO NOTHING`,
        [rows[0].id, rows[0].hub_id]
      );
    }

    // Real trigger #1 (of the 4 confirmed for notifications — see
    // migration 019's header comment): a real sub-order status change
    // to 'shipped' or 'delivered' notifies the real buyer. Part of the
    // SAME transaction as the real status update itself, not a
    // separate best-effort step.
    if (status === 'shipped' || status === 'delivered') {
      const { rows: orderRows } = await client.query('SELECT buyer_id FROM orders WHERE id = $1', [rows[0].order_id]);
      await createNotification({
        userId: orderRows[0]?.buyer_id,
        type: 'order_status',
        title: status === 'shipped' ? 'Your order has shipped' : 'Your order has been delivered',
        body: `Order ${rows[0].order_id} is now ${status}.`,
        linkType: 'order',
        linkId: rows[0].order_id,
      }, client);
    }

    await client.query('COMMIT');
    res.json({ subOrderId: rows[0].id, orderId: rows[0].order_id, status: rows[0].status, trackingNumber: rows[0].tracking_number });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /supplier/me/overview — real aggregate KPIs for this supplier's own
// dashboard landing page. Same honesty principle as the admin dashboard's
// GET /overview (see that module's header comment): NO fabricated ¥
// sales figure. The "settlement currency is RMB" business rule (see
// apps/supplier-portal/README.md) is about how a supplier gets PAID OUT
// once a payout system exists — it does not mean summing raw
// order_line_items amounts (which are in whatever currency the BUYER
// paid in, not RMB) and calling that a real RMB sales total. That would
// require both a payout/commission system and FX conversion, neither of
// which exist yet. Uses counts everywhere a currency amount would be
// fabricated. Also no fake star rating — there's no reviews/ratings
// system in this schema yet (see db/README.md's "not yet covered" list).
router.get('/me/overview', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const supplierId = req.user.supplierId;
    const [totalOrders, pendingOrders, totalListings, pendingReturns, ordersByDay, topProducts, recentOrders] = await Promise.all([
      db.query('SELECT COUNT(*) AS n FROM supplier_sub_orders WHERE supplier_id = $1', [supplierId]),
      db.query(`SELECT COUNT(*) AS n FROM supplier_sub_orders WHERE supplier_id = $1 AND status IN ('pending', 'preparing')`, [supplierId]),
      db.query('SELECT COUNT(*) AS n FROM products WHERE supplier_id = $1', [supplierId]),
      db.query(
        `SELECT COUNT(*) AS n FROM return_cases rc JOIN supplier_sub_orders so ON so.id = rc.sub_order_id
         WHERE so.supplier_id = $1 AND rc.status IN ('awaiting', 'in_progress')`,
        [supplierId]
      ),
      db.query(
        `SELECT date_trunc('day', o.placed_at) AS day, COUNT(*) AS n
         FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id
         WHERE so.supplier_id = $1 AND o.placed_at > now() - interval '7 days'
         GROUP BY day ORDER BY day ASC`,
        [supplierId]
      ),
      db.query(
        `SELECT p.id, p.name, SUM(oli.quantity) AS units
         FROM order_line_items oli
         JOIN supplier_sub_orders so ON so.id = oli.sub_order_id
         JOIN products p ON p.id = oli.product_id
         WHERE so.supplier_id = $1
         GROUP BY p.id, p.name ORDER BY units DESC LIMIT 4`,
        [supplierId]
      ),
      db.query(
        `SELECT so.id AS sub_order_id, so.order_id, so.status, o.placed_at
         FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id
         WHERE so.supplier_id = $1
         ORDER BY o.placed_at DESC LIMIT 5`,
        [supplierId]
      ),
    ]);

    res.json({
      totalOrders: Number(totalOrders.rows[0].n),
      pendingOrders: Number(pendingOrders.rows[0].n),
      totalListings: Number(totalListings.rows[0].n),
      pendingReturns: Number(pendingReturns.rows[0].n),
      ordersByDay: ordersByDay.rows.map((r) => ({ day: r.day, count: Number(r.n) })),
      topProducts: topProducts.rows.map((r) => ({ id: r.id, name: r.name, units: Number(r.units) })),
      recentOrders: recentOrders.rows.map((r) => ({ subOrderId: r.sub_order_id, orderId: r.order_id, status: r.status, placedAt: r.placed_at })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
