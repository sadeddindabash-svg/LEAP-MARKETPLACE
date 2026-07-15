const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');

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
    price: Number(row.price),
    currencyCode: row.currency_code,
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

// GET /catalog/products?category=brake&vehicleId=v1&lang=en|ar
router.get('/products', async (req, res, next) => {
  try {
    const { category, vehicleId, lang } = req.query;
    const conditions = [];
    const params = [];

    let sql = `SELECT p.* FROM products p`;
    if (vehicleId) {
      sql += ` JOIN product_fitment pf ON pf.product_id = p.id AND pf.vehicle_id = $${params.length + 1}`;
      params.push(vehicleId);
    }
    if (category) {
      conditions.push(`p.category = $${params.length + 1}`);
      params.push(category);
    }
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;

    const { rows } = await db.query(sql, params);
    const dtos = await Promise.all(rows.map(async (r) => attachBuyerImages(toBuyerProductDto(r, lang), r.id)));
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
router.get('/moderation-queue', requireAuth, requireRole('admin'), async (req, res, next) => {
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
router.patch('/products/:id/moderate', requireAuth, requireRole('admin'), async (req, res, next) => {
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

module.exports = router;
