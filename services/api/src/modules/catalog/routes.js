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

function toProductDto(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    currencyCode: row.currency_code,
    supplierName: row.supplier_name,
    rating: row.rating != null ? Number(row.rating) : null,
    reviewCount: row.review_count,
    stockQuantity: row.stock_quantity,
    estimatedDeliveryDays: row.estimated_delivery_days,
    status: row.status,
  };
}

// GET /catalog/products?category=brake&vehicleId=v1
router.get('/products', async (req, res, next) => {
  try {
    const { category, vehicleId } = req.query;
    const conditions = [];
    const params = [];

    let sql = `
      SELECT p.*, s.name AS supplier_name
      FROM products p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
    `;
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
    res.json(rows.map(toProductDto));
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const fitmentResult = await db.query('SELECT vehicle_id FROM product_fitment WHERE product_id = $1', [req.params.id]);
    res.json({ ...toProductDto(rows[0]), fitsVehicleIds: fitmentResult.rows.map((r) => r.vehicle_id) });
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

// PATCH /catalog/products/:id/moderate  { action: 'approve' | 'reject', nameEn?, descriptionEn? }
// Approving REQUIRES nameEn — the whole point of this queue is that a
// supplier's Chinese submission needs a real Leap-team-reviewed
// translation before it goes live to buyers (per the product
// requirement), not just a status flip. Rejecting doesn't need a
// translation, since the listing never goes live either way.
router.patch('/products/:id/moderate', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { action, nameEn, descriptionEn } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }
    if (action === 'approve' && !nameEn) {
      return res.status(400).json({ error: 'nameEn is required to approve — enter the reviewed English translation first' });
    }
    const newStatus = action === 'approve' ? 'active' : 'inactive';
    const { rows } = await db.query(
      `UPDATE products SET status = $1, name = COALESCE($2, name), description = COALESCE($3, description) WHERE id = $4 RETURNING id, name, status`,
      [newStatus, action === 'approve' ? nameEn : null, action === 'approve' ? (descriptionEn || null) : null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
