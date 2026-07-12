const express = require('express');

/**
 * Order module — BUY-031, BUY-050–053. A single buyer order splits into
 * per-supplier sub-orders; the buyer only ever sees one order and one total
 * (see docs/SRS.docx Section 3.1.4). Guest checkout is supported per the
 * product decision in the Charter — orderPayload.guestEmail is used when no
 * userId is present.
 */
const router = express.Router();

const orders = new Map(); // orderId -> order

let orderSequence = 208841;

// Placeholder — replace with a real product/supplier lookup (see catalog module).
const PRODUCT_SUPPLIER = {
  p1: 'Guangzhou AutoParts Co.',
  p4: 'Ningbo Filtration Ltd.',
};

function splitIntoSupplierSubOrders(items) {
  const bySupplier = {};
  for (const item of items) {
    const supplier = PRODUCT_SUPPLIER[item.productId] || 'Unknown Supplier';
    (bySupplier[supplier] ||= []).push(item);
  }
  return Object.entries(bySupplier).map(([supplierName, subItems]) => ({
    supplierName,
    items: subItems,
    status: 'pending',
  }));
}

// POST /order  { items: [{productId, quantity}], userId? , guestEmail? }
router.post('/', (req, res) => {
  const { items, userId, guestEmail } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items is required and must be non-empty' });
  }
  if (!userId && !guestEmail) {
    return res.status(400).json({ error: 'either userId or guestEmail is required (guest checkout)' });
  }

  const id = `LP-${orderSequence++}`;
  const order = {
    id,
    userId: userId || null,
    guestEmail: guestEmail || null,
    isGuestOrder: !userId,
    placedAt: new Date().toISOString(),
    status: 'to_ship',
    supplierSubOrders: splitIntoSupplierSubOrders(items),
  };
  orders.set(id, order);
  res.status(201).json(order);
});

router.get('/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

router.get('/', (req, res) => {
  res.json(Array.from(orders.values()));
});

module.exports = router;
