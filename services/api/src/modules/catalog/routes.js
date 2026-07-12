const express = require('express');
const db = require('../../../db/pool');

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

module.exports = router;
