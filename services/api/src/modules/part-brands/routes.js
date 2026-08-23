const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');

/**
 * Part-brands module -- real part manufacturer brands (e.g. MAHLE,
 * RIDEX, Hongqi), confirmed directly with the person as a genuinely
 * separate real entity from vehicle_brands (which is real vehicle
 * makes like BMW/Toyota, used for fitment). A product can optionally
 * reference one of these via products.brand_id (migration 067) --
 * shown to a buyer as a real small logo badge on the product card.
 */
const router = express.Router();

function isUniqueViolation(err) {
  return err && err.code === '23505';
}
function isForeignKeyViolation(err) {
  return err && err.code === '23503';
}

function toDto(row) {
  return { id: row.id, name: row.name, nameAr: row.name_ar, logoUrl: row.logo_url };
}

// GET /part-brands -- public (used both by the admin portal's own
// management page and by supplier-facing product forms to pick a
// brand for their own product).
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM part_brands ORDER BY name ASC');
    res.json(rows.map(toDto));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, nameAr, logoUrl } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const id = `part_brand_${Date.now()}`;
    await db.query(
      'INSERT INTO part_brands (id, name, name_ar, logo_url) VALUES ($1, $2, $3, $4)',
      [id, name.trim(), nameAr?.trim() || null, logoUrl?.trim() || null]
    );
    await logAdminAction(req, 'part_brand_created', 'part_brand', id, { name: name.trim() });
    res.status(201).json({ id, name: name.trim(), nameAr: nameAr?.trim() || null, logoUrl: logoUrl?.trim() || null });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: `A brand named "${req.body.name}" already exists` });
    next(err);
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, nameAr } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await db.query(
      'UPDATE part_brands SET name = $1, name_ar = $2 WHERE id = $3 RETURNING *',
      [name.trim(), nameAr?.trim() || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Brand not found' });
    await logAdminAction(req, 'part_brand_updated', 'part_brand', req.params.id, { name: name.trim() });
    res.json(toDto(rows[0]));
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: `A brand named "${req.body.name}" already exists` });
    next(err);
  }
});

router.patch('/:id/logo', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { logoUrl } = req.body || {};
    if (!logoUrl || !logoUrl.trim()) return res.status(400).json({ error: 'logoUrl is required' });
    const { rows } = await db.query('UPDATE part_brands SET logo_url = $1 WHERE id = $2 RETURNING *', [logoUrl.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Brand not found' });
    await logAdminAction(req, 'part_brand_logo_changed', 'part_brand', req.params.id, {});
    res.json(toDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT name FROM part_brands WHERE id = $1', [req.params.id]);
    const { rowCount } = await db.query('DELETE FROM part_brands WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Brand not found' });
    await logAdminAction(req, 'part_brand_deleted', 'part_brand', req.params.id, { name: rows[0]?.name });
    res.status(204).end();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ error: 'Cannot delete — one or more products are assigned to this brand. Reassign or clear those first.' });
    }
    next(err);
  }
});

// PATCH /part-brands/assign/:productId  { brandId }  -- admin-only,
// simple assignment path. No general product-edit UI exists in the
// admin portal yet (products are created and managed entirely by
// suppliers) -- confirmed this scoped, minimal capability is
// sufficient for now rather than building a full product-management
// system as part of this feature.
router.patch('/assign/:productId', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { brandId } = req.body || {};
    if (brandId) {
      const brandCheck = await db.query('SELECT id FROM part_brands WHERE id = $1', [brandId]);
      if (brandCheck.rows.length === 0) return res.status(400).json({ error: 'Unknown brandId' });
    }
    const { rows } = await db.query('UPDATE products SET brand_id = $1 WHERE id = $2 RETURNING id, name, brand_id', [brandId || null, req.params.productId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    await logAdminAction(req, 'product_brand_assigned', 'product', req.params.productId, { brandId: brandId || null });
    res.json({ productId: rows[0].id, productName: rows[0].name, brandId: rows[0].brand_id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
