const express = require('express');

/**
 * Catalog module — products, categories, translations.
 * Corresponds to SRS BUY-020–025 (buyer-facing browsing/search) and
 * SUP-010–015 (supplier-side product management).
 *
 * This is a placeholder in-memory implementation so the mobile app and
 * admin dashboard have something real to call during early development.
 * Replace with real persistence (see services/api/README.md) before this
 * goes anywhere near production — data resets on every server restart.
 */
const router = express.Router();

const PLACEHOLDER_PRODUCTS = [
  {
    id: 'p1',
    name: 'RIDEX Front Brake Disc, Vented 300mm',
    category: 'brake',
    price: 34.9,
    currencyCode: 'USD',
    supplierName: 'Guangzhou AutoParts Co.',
    rating: 4.6,
    reviewCount: 812,
    stockQuantity: 320,
    estimatedDeliveryDays: 6,
    fitsVehicleIds: ['v1'],
  },
  {
    id: 'p4',
    name: 'MAHLE Oil Filter Element',
    category: 'filters',
    price: 6.9,
    currencyCode: 'USD',
    supplierName: 'Ningbo Filtration Ltd.',
    rating: 4.7,
    reviewCount: 2210,
    stockQuantity: 540,
    estimatedDeliveryDays: 4,
    fitsVehicleIds: ['v1', 'v2', 'v3'],
  },
];

// GET /catalog/products?category=brake&vehicleId=v1
router.get('/products', (req, res) => {
  const { category, vehicleId } = req.query;
  let results = PLACEHOLDER_PRODUCTS;
  if (category) results = results.filter((p) => p.category === category);
  if (vehicleId) results = results.filter((p) => p.fitsVehicleIds.includes(vehicleId));
  res.json(results);
});

router.get('/products/:id', (req, res) => {
  const product = PLACEHOLDER_PRODUCTS.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

module.exports = router;
