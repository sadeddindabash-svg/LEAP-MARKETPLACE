const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { calculateBuyerPriceUsd } = require('../pricing/engine');

/**
 * Catalog module — products, categories, translations.
 * Corresponds to SRS BUY-020–025 (buyer-facing browsing/search) and
 * SUP-010–015 (supplier-side product management).
 *
 * Backed by a real PostgreSQL database (see db/migrations/001_init.sql) —
 * data now survives a server restart, unlike the earlier in-memory version.
 */
const router = express.Router();

// Resolves which language's name/description a buyer sees, masking away
// the underlying name_ar/description_ar columns behind a single clean
// name/description field in the OUTPUT — the mobile app doesn't need to
// know which column was used, just "give me the product in my chosen
// language." Falls back to the English fields if Arabic is somehow
// missing (shouldn't happen for a live listing, since both are now
// mandatory to approve — see migration 012 — but defensive regardless).
// Deliberately never includes name_zh/description_zh here at all — a
// buyer should never see the untranslated Chinese original, full stop.
function resolveLanguage(row, lang) {
  if (lang === 'ar' && row.name_ar) {
    return { name: row.name_ar, description: row.description_ar || row.description };
  }
  return { name: row.name, description: row.description };
}

// Buyer-facing DTO. Deliberately does NOT include supplier identity
// (name, id, anything) — buyers should never see who the supplier is;
// that's platform-internal information. Also deliberately does NOT
// include name_zh/description_zh (see resolveLanguage above) — only the
// resolved, approved translation for the requested language.
//
// `price` here is a PLACEHOLDER, overwritten by attachBuyerPrice below
// — never the raw `row.price` (which is the supplier's RMB cost, not
// what a buyer should ever see directly). Computing it requires a real
// async call to the pricing engine, so it's split into a separate step
// rather than done inline here.
function toBuyerProductDto(row, lang) {
  const { name, description } = resolveLanguage(row, lang);
  return {
    id: row.id,
    name,
    description,
    category: row.category,
    part: row.part,
    position: row.position,
    oemNumber: row.oem_number,
    currencyCode: 'USD', // confirmed: buyer-facing price is always USD for now
    rating: row.rating != null ? Number(row.rating) : null,
    reviewCount: row.review_count,
    stockQuantity: row.stock_quantity,
    estimatedDeliveryDays: row.estimated_delivery_days,
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    lengthCm: row.length_cm === null ? null : Number(row.length_cm),
    widthCm: row.width_cm === null ? null : Number(row.width_cm),
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
    status: row.status,
  };
}

// Computes the REAL, LIVE buyer-facing USD price from the supplier's RMB
// cost (row.price) and the product's real shipping dimensions — see
// services/api/src/modules/pricing/engine.js for the full calculation.
// This is why product prices reflect a fee/FX-rate change immediately
// (confirmed as the wanted behavior), rather than a price computed once
// and stored.
//
// TRANSITION HANDLING, real and deliberate: products submitted BEFORE
// this feature existed (this project's own seed data, e.g. p1/p4/p9)
// are priced directly in USD, not RMB — running that USD amount through
// an RMB->USD equation would silently produce nonsense (treating $34.90
// as if it were ¥34.90). Those legacy rows pass through with their
// existing price/currency unchanged; only real RMB-priced products (the
// only kind submitted going forward — see the supplier module's
// currencyCode lock) go through the real equation.
async function attachBuyerPrice(dto, row) {
  if (row.currency_code !== 'CNY') {
    return { ...dto, price: Number(row.price), currencyCode: row.currency_code };
  }
  const result = await calculateBuyerPriceUsd({
    supplierCostCny: Number(row.price),
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    lengthCm: row.length_cm === null ? null : Number(row.length_cm),
    widthCm: row.width_cm === null ? null : Number(row.width_cm),
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
  });
  return { ...dto, price: result.buyerPriceUsd };
}

async function attachBuyerImages(dto, productId) {
  const { rows: images } = await db.query('SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order', [productId]);
  return { ...dto, images: images.map((i) => i.url) };
}

// Real Brand/Model/Year for the product page, resolved from the
// structured fitment cascade (migration 010). A product can technically
// have multiple fitment entries (fits several vehicle configurations);
// this shows the FIRST one as the primary display, matching a simple
// flat "Brand: / Model: / Year:" product-page layout. If multi-fitment
// products become common enough that buyers need to see the full list,
// that's a real follow-up, not something to overbuild here on a guess.
async function attachPrimaryFitment(dto, productId) {
  const { rows } = await db.query(
    `SELECT vb.name AS brand, vm.name AS model, pfe.year
     FROM product_fitment_entries pfe
     JOIN vehicle_generations vg ON vg.id = pfe.generation_id
     JOIN vehicle_models vm ON vm.id = vg.model_id
     JOIN vehicle_brands vb ON vb.id = vm.brand_id
     WHERE pfe.product_id = $1
     ORDER BY pfe.id ASC LIMIT 1`,
    [productId]
  );
  const primary = rows[0] || null;
  return { ...dto, brand: primary?.brand || null, model: primary?.model || null, year: primary?.year || null };
}

// GET /catalog/products?category=brake&part=Front+Brake+Disc&vehicleId=v1&search=bmw+brake&sort=newest&lang=en|ar
router.get('/products', async (req, res, next) => {
  try {
    const { category, part, vehicleId, search, sort, lang } = req.query;
    const conditions = [];
    const params = [];

    let sql = `SELECT p.* FROM products p`;
    if (vehicleId) {
      sql += ` JOIN product_fitment pf ON pf.product_id = p.id AND pf.vehicle_id = $${params.length + 1}`;
      params.push(vehicleId);
    }

    // BUG FIX, found while adding search: this endpoint had NO status
    // filter at all -- a still-'translating' or 'pending' product (not
    // yet reviewed, not yet buyer-facing per every other part of this
    // system) could leak into buyer browsing and search results. Real
    // and worth fixing here rather than separately, since search is
    // exactly where an unapproved listing would first become visible.
    conditions.push(`p.status = 'active'`);

    if (category) {
      conditions.push(`p.category = $${params.length + 1}`);
      params.push(category);
    }

    // Real EXACT part filter -- distinct from `search`, which fuzzy-
    // matches partial words. This is for "tap a real Part in the
    // category browser, see exactly the products for that Part" --
    // wants precision, not a fuzzy multi-word match.
    if (part) {
      conditions.push(`p.part = $${params.length + 1}`);
      params.push(part);
    }

    // Real multi-word search: EVERY word must match SOMEWHERE (name in
    // either language, part, OEM number, category, or the vehicle
    // brand/model this product fits) -- "bmw brake" finds brake
    // products that fit a BMW, not just literal string "bmw brake".
    // Uses EXISTS rather than a JOIN to the fitment cascade so a
    // product with multiple fitment entries doesn't come back as
    // duplicate rows.
    if (search && search.trim()) {
      const words = search.trim().split(/\s+/).slice(0, 8); // cap word count -- a search box isn't meant to take a paragraph
      for (const word of words) {
        const idx = params.length + 1;
        conditions.push(
          `(p.name ILIKE $${idx} OR p.name_ar ILIKE $${idx} OR p.part ILIKE $${idx} OR p.oem_number ILIKE $${idx} OR p.category ILIKE $${idx}
            OR EXISTS (
              SELECT 1 FROM product_fitment_entries pfe
              JOIN vehicle_generations vg ON vg.id = pfe.generation_id
              JOIN vehicle_models vm ON vm.id = vg.model_id
              JOIN vehicle_brands vb ON vb.id = vm.brand_id
              WHERE pfe.product_id = p.id AND (vb.name ILIKE $${idx} OR vm.name ILIKE $${idx})
            ))`
        );
        params.push(`%${word}%`);
      }
    }

    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;

    // Real, explicit ordering -- this endpoint previously had NO
    // ORDER BY at all (whatever order Postgres happened to return was
    // incidental, not a real guarantee). "newest" is a real, confirmed
    // filter option on the home feed; the default (no sort param)
    // stays unordered-by-date for now, matching prior behavior for
    // category/search browsing where recency isn't the point.
    if (sort === 'newest') sql += ' ORDER BY p.created_at DESC';

    const { rows } = await db.query(sql, params);
    const dtos = await Promise.all(rows.map(async (r) => {
      let dto = toBuyerProductDto(r, lang);
      dto = await attachBuyerImages(dto, r.id);
      dto = await attachBuyerPrice(dto, r);
      return dto;
    }));
    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', async (req, res, next) => {
  try {
    const { lang } = req.query;
    const { rows } = await db.query(`SELECT p.* FROM products p WHERE p.id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const fitmentResult = await db.query('SELECT vehicle_id FROM product_fitment WHERE product_id = $1', [req.params.id]);
    let dto = toBuyerProductDto(rows[0], lang);
    dto = await attachBuyerImages(dto, req.params.id);
    dto = await attachPrimaryFitment(dto, req.params.id);
    dto = await attachBuyerPrice(dto, rows[0]);
    res.json({ ...dto, fitsVehicleIds: fitmentResult.rows.map((r) => r.vehicle_id) });
  } catch (err) {
    next(err);
  }
});

// ---------------- Catalog moderation (ADM-002, admin-only) ----------------
// Kept in this file rather than a separate module since it operates
// entirely on the products table this module already owns.

// GET /catalog/moderation-queue — products with status='translating',
// i.e. awaiting review before going live to buyers. Flags are computed
// live from real data rather than stored/fabricated:
//   - "Missing fitment data": zero rows in product_fitment_entries (the
//     structured Brand->Model->Generation cascade, migration 010) for
//     this product
//   - "New supplier": the supplier account is less than 30 days old
// Includes the supplier's original Chinese submission (name_zh,
// description_zh) and photos, so an admin reviewer can see exactly what
// was submitted and enter a real English translation as part of approval
// — see PATCH .../moderate below.
router.get('/moderation-queue', requireAuth, requireRole('admin'), requirePageAccess('moderation'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        p.id, p.name, p.name_zh, p.description_zh, p.category, p.part, p.position, p.oem_number, p.created_at,
        s.name AS supplier_name,
        s.created_at AS supplier_created_at,
        (SELECT COUNT(*) FROM product_fitment_entries pfe WHERE pfe.product_id = p.id) AS fitment_count
      FROM products p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.status = 'translating'
      ORDER BY p.created_at ASC
    `);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const withImages = await Promise.all(rows.map(async (r) => {
      const { rows: images } = await db.query('SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order', [r.id]);
      const flags = [];
      if (Number(r.fitment_count) === 0) flags.push('Missing fitment data');
      if (r.supplier_created_at && new Date(r.supplier_created_at) > thirtyDaysAgo) flags.push('New supplier');
      return {
        id: r.id,
        name: r.name,
        nameZh: r.name_zh,
        descriptionZh: r.description_zh,
        category: r.category,
        part: r.part,
        position: r.position,
        oemNumber: r.oem_number,
        images: images.map((i) => i.url),
        supplierName: r.supplier_name,
        submittedAt: r.created_at,
        flags,
      };
    }));
    res.json(withImages);
  } catch (err) {
    next(err);
  }
});

// PATCH /catalog/products/:id/moderate  { action: 'approve' | 'reject', nameEn?, descriptionEn?, nameAr?, descriptionAr? }
// Approving REQUIRES BOTH nameEn and nameAr — the whole point of this
// queue is that a supplier's Chinese submission needs real
// Leap-team-reviewed translations before it goes live to buyers (per
// the confirmed business requirement covering the full GCC + Jordan
// launch markets), not just a status flip. Rejecting doesn't need a
// translation, since the listing never goes live either way.
router.patch('/products/:id/moderate', requireAuth, requireRole('admin'), requirePageAccess('moderation'), async (req, res, next) => {
  try {
    const { action, nameEn, descriptionEn, nameAr, descriptionAr } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }
    // Both required, not just English — the confirmed 40-country launch
    // list includes the entire GCC plus Jordan, real markets where
    // Arabic isn't optional. Reported together so an admin doesn't have
    // to submit twice to discover the second thing they forgot.
    const missing = [];
    if (action === 'approve' && !nameEn) missing.push('nameEn');
    if (action === 'approve' && !nameAr) missing.push('nameAr');
    if (missing.length > 0) {
      return res.status(400).json({ error: `${missing.join(' and ')} required to approve — enter the reviewed translation(s) first` });
    }
    const newStatus = action === 'approve' ? 'active' : 'inactive';
    const { rows } = await db.query(
      `UPDATE products SET
         status = $1,
         name = COALESCE($2, name), description = COALESCE($3, description),
         name_ar = COALESCE($4, name_ar), description_ar = COALESCE($5, description_ar)
       WHERE id = $6 RETURNING id, name, name_ar, status`,
      [
        newStatus,
        action === 'approve' ? nameEn : null, action === 'approve' ? (descriptionEn || null) : null,
        action === 'approve' ? nameAr : null, action === 'approve' ? (descriptionAr || null) : null,
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Real, admin-managed category + part reference lists (migration 015).
// Confirmed requirement: a supplier picks a real Part from a real list
// scoped to the Category they selected, rather than typing free text.
// Same structural idea as the Vehicle Data fitment cascade, two levels
// instead of four. Public GET endpoints are used by both the supplier
// portal (populating its Category/Part dropdowns) and the mobile app
// (the home screen's category grid, no longer hardcoded).
// ============================================================

function toCategoryDto(row) {
  return { id: row.id, nameEn: row.name_en, nameAr: row.name_ar, sortOrder: row.sort_order };
}
function toPartDto(row) {
  return { id: row.id, categoryId: row.category_id, nameEn: row.name_en, nameAr: row.name_ar, sortOrder: row.sort_order };
}

router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM product_categories ORDER BY sort_order ASC');
    res.json(rows.map(toCategoryDto));
  } catch (err) {
    next(err);
  }
});

router.post('/categories', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { id, nameEn, nameAr, sortOrder } = req.body || {};
    if (!id || !nameEn) return res.status(400).json({ error: 'id and nameEn are required' });
    await db.query(
      'INSERT INTO product_categories (id, name_en, name_ar, sort_order) VALUES ($1, $2, $3, $4)',
      [id, nameEn, nameAr || null, sortOrder ?? 0]
    );
    const { rows } = await db.query('SELECT * FROM product_categories WHERE id = $1', [id]);
    res.status(201).json(toCategoryDto(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: `A category with id "${req.body?.id}" already exists` });
    next(err);
  }
});

// Deleting a category real-protects against orphaning real products —
// same "you cannot delete what's actually referenced" pattern as
// Vehicle Data and Hubs, not silently allowed and not a raw DB error.
router.delete('/categories/:id', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { rows: productsUsingIt } = await db.query('SELECT id FROM products WHERE category = $1 LIMIT 1', [req.params.id]);
    if (productsUsingIt.length > 0) {
      return res.status(409).json({ error: 'Cannot delete this category — real products still reference it' });
    }
    // Real bug found via testing: category_parts.category_id has a FK
    // to product_categories with no CASCADE — deleting a category that
    // still has parts attached (even ones no product actually uses)
    // would otherwise throw a raw, uncaught DB constraint error (a
    // real 500, not a real 409) instead of a clear, specific message.
    // An admin should remove/reassign a category's parts first, which
    // keeps the operation intentional rather than silently orphaning
    // reference data.
    const { rows: partsUsingIt } = await db.query('SELECT id FROM category_parts WHERE category_id = $1 LIMIT 1', [req.params.id]);
    if (partsUsingIt.length > 0) {
      return res.status(409).json({ error: 'Cannot delete this category — it still has parts. Delete those first.' });
    }
    const { rowCount } = await db.query('DELETE FROM product_categories WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Category not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/categories/:id/parts', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM category_parts WHERE category_id = $1 ORDER BY sort_order ASC', [req.params.id]);
    res.json(rows.map(toPartDto));
  } catch (err) {
    next(err);
  }
});

router.post('/categories/:id/parts', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { nameEn, nameAr, sortOrder } = req.body || {};
    if (!nameEn) return res.status(400).json({ error: 'nameEn is required' });
    const categoryCheck = await db.query('SELECT id FROM product_categories WHERE id = $1', [req.params.id]);
    if (categoryCheck.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    const partId = `part_${Date.now()}`;
    await db.query(
      'INSERT INTO category_parts (id, category_id, name_en, name_ar, sort_order) VALUES ($1, $2, $3, $4, $5)',
      [partId, req.params.id, nameEn, nameAr || null, sortOrder ?? 0]
    );
    const { rows } = await db.query('SELECT * FROM category_parts WHERE id = $1', [partId]);
    res.status(201).json(toPartDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Deleting a part real-protects against orphaning real products that
// were submitted with that exact part name — see the supplier module's
// header comment on why `products.part` stays plain text (validated
// against this list, not a foreign key) rather than being changed to
// reference category_parts.id directly.
router.delete('/parts/:id', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { rows: partRows } = await db.query('SELECT * FROM category_parts WHERE id = $1', [req.params.id]);
    if (partRows.length === 0) return res.status(404).json({ error: 'Part not found' });
    const { rows: productsUsingIt } = await db.query('SELECT id FROM products WHERE part = $1 LIMIT 1', [partRows[0].name_en]);
    if (productsUsingIt.length > 0) {
      return res.status(409).json({ error: 'Cannot delete this part — real products still reference it' });
    }
    await db.query('DELETE FROM category_parts WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
// Real product DTO helpers, exported for reuse by other modules that
// need to render a real buyer-facing product (e.g. the wishlist module) —
// avoids re-implementing the same language resolution / live pricing /
// photo attachment logic in a second place, which would risk drift.
module.exports.toBuyerProductDto = toBuyerProductDto;
module.exports.attachBuyerPrice = attachBuyerPrice;
module.exports.attachBuyerImages = attachBuyerImages;
