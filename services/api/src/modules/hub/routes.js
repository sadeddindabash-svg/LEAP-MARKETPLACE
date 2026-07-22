const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { createNotification } = require('../notifications/helpers');
const { sendTransactionalEmail } = require('../email/client');
const { deliveryNotificationEmail } = require('../email/templates');

/**
 * Inspection hub module (migration 011) — new business requirement:
 * every order now routes Supplier -> Hub -> Buyer, never supplier direct
 * to buyer. See that migration's header comment for the full design.
 *
 * Three audiences share this module:
 *   - Admin: manage hub locations, assign a hub to a sub-order
 *   - Hub staff (role='hub_staff', scoped to req.user.hubId): their own
 *     hub's inbound queue and step-by-step shipment workflow
 *   - (Buyers/suppliers don't call this module directly yet — the
 *     buyer-facing tracking UI reflecting hub status is a planned
 *     fast-follow, not built in this pass.)
 */
const router = express.Router();

const STATUS_ORDER = ['awaiting_receipt', 'received', 'opened', 'inspected', 'packed', 'shipped_to_buyer'];

function toHubDto(row) {
  return { id: row.id, name: row.name, region: row.region, address: row.address, dailyCapacity: row.daily_capacity, createdAt: row.created_at };
}

// ============================================================
// Admin: manage hub locations. GET is public (not sensitive, and the
// admin assignment picker + any future public "where's my hub" page
// both want it) — writes are admin-only.
// ============================================================

router.get('/locations', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM hubs ORDER BY name');
    res.json(rows.map(toHubDto));
  } catch (err) {
    next(err);
  }
});

router.post('/locations', requireAuth, requireRole('admin'), requirePageAccess('hubs'), async (req, res, next) => {
  try {
    const { name, region, address, dailyCapacity } = req.body || {};
    if (!name || !region) return res.status(400).json({ error: 'name and region are required' });
    if (dailyCapacity !== undefined && (!Number.isInteger(dailyCapacity) || dailyCapacity <= 0)) {
      return res.status(400).json({ error: 'dailyCapacity must be a positive whole number' });
    }
    const id = `hub_${Date.now()}`;
    await db.query(
      'INSERT INTO hubs (id, name, region, address, daily_capacity) VALUES ($1, $2, $3, $4, COALESCE($5, 50))',
      [id, name.trim(), region.trim(), address || null, dailyCapacity || null]
    );
    const { rows } = await db.query('SELECT * FROM hubs WHERE id = $1', [id]);
    res.status(201).json(toHubDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Real, admin-configurable hub capacity (migration 042) -- separate
// PATCH from the create endpoint above since editing an existing
// real hub's capacity is a distinct real action from creating one.
router.patch('/locations/:id', requireAuth, requireRole('admin'), requirePageAccess('hubs'), async (req, res, next) => {
  try {
    const { dailyCapacity } = req.body || {};
    if (dailyCapacity === undefined) return res.status(400).json({ error: 'dailyCapacity is required' });
    if (!Number.isInteger(dailyCapacity) || dailyCapacity <= 0) {
      return res.status(400).json({ error: 'dailyCapacity must be a positive whole number' });
    }
    const { rows } = await db.query('UPDATE hubs SET daily_capacity = $1 WHERE id = $2 RETURNING *', [dailyCapacity, req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Hub not found' });
    res.json(toHubDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/locations/:id', requireAuth, requireRole('admin'), requirePageAccess('hubs'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM hubs WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Hub not found' });
    res.status(204).end();
  } catch (err) {
    if (err && err.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete — one or more staff accounts or shipments reference this hub. Reassign or remove those first.' });
    }
    next(err);
  }
});

// GET /hub/workload — admin-only, real current workload vs real
// capacity for every real hub (migration 042). "In-hub workload" is
// deliberately defined as every real stage BEFORE shipped_to_buyer
// (awaiting_receipt, received, opened, inspected, packed) plus
// flagged -- once a real shipment ships to the buyer, it has
// physically left the hub's premises and is no longer really part of
// its active workload, even though the real database row isn't
// deleted.
router.get('/workload', requireAuth, requireRole('admin'), requirePageAccess('hubs'), async (req, res, next) => {
  try {
    const { rows: hubs } = await db.query('SELECT * FROM hubs ORDER BY name');
    const { rows: workloadRows } = await db.query(
      `SELECT hub_id, status, COUNT(*) AS n
       FROM hub_shipments
       WHERE status NOT IN ('shipped_to_buyer', 'delivered')
       GROUP BY hub_id, status`
    );
    const byHub = {};
    for (const row of workloadRows) {
      if (!byHub[row.hub_id]) byHub[row.hub_id] = {};
      byHub[row.hub_id][row.status] = Number(row.n);
    }

    res.json(hubs.map((h) => {
      const stageCounts = byHub[h.id] || {};
      const totalWorkload = Object.values(stageCounts).reduce((sum, n) => sum + n, 0);
      return {
        id: h.id,
        name: h.name,
        region: h.region,
        dailyCapacity: h.daily_capacity,
        totalWorkload,
        utilizationPercent: h.daily_capacity > 0 ? Math.round((totalWorkload / h.daily_capacity) * 100) : 0,
        stageCounts: {
          awaitingReceipt: stageCounts.awaiting_receipt || 0,
          received: stageCounts.received || 0,
          opened: stageCounts.opened || 0,
          inspected: stageCounts.inspected || 0,
          packed: stageCounts.packed || 0,
          flagged: stageCounts.flagged || 0,
        },
      };
    }));
  } catch (err) {
    next(err);
  }
});

// PATCH /hub/assign/:subOrderId  { hubId } — admin assigns which hub a
// sub-order routes through. Required before a supplier can mark it shipped.
router.patch('/assign/:subOrderId', requireAuth, requireRole('admin'), requirePageAccess('hubs'), async (req, res, next) => {
  try {
    const { hubId } = req.body || {};
    if (!hubId) return res.status(400).json({ error: 'hubId is required' });
    const hubCheck = await db.query('SELECT id FROM hubs WHERE id = $1', [hubId]);
    if (hubCheck.rows.length === 0) return res.status(404).json({ error: 'Hub not found' });

    const { rows } = await db.query(
      'UPDATE supplier_sub_orders SET hub_id = $1 WHERE id = $2 RETURNING id, hub_id',
      [hubId, req.params.subOrderId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Sub-order not found' });
    res.json({ subOrderId: rows[0].id, hubId: rows[0].hub_id });
  } catch (err) {
    next(err);
  }
});

// GET /hub/flagged — admin-only, real queue of every flagged shipment
// across ALL hubs (unlike GET /hub/me/shipments, which is scoped to one
// hub's own staff). This is the actual answer to "where do I find a
// flagged shipment" — before this existed, an admin could only discover
// one by already knowing which order to open, with no queue and no
// notification at all.
router.get('/flagged', requireAuth, requireRole('admin'), requirePageAccess('flagged'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT hs.id, hs.status, hs.created_at, hs.updated_at, so.id AS sub_order_id, so.order_id,
              s.name AS supplier_name, h.name AS hub_name
       FROM hub_shipments hs
       JOIN supplier_sub_orders so ON so.id = hs.sub_order_id
       JOIN suppliers s ON s.id = so.supplier_id
       LEFT JOIN hubs h ON h.id = hs.hub_id
       WHERE hs.status = 'flagged'
       ORDER BY hs.updated_at DESC`
    );
    const shipments = await Promise.all(rows.map(async (r) => {
      const events = await attachEventsAndPhotos(r);
      // The flag itself is always the LAST event on a flagged shipment
      // (see POST /hub/me/shipments/:id/events -- the flagged branch is
      // terminal), so this is the specific note/photos an admin needs
      // to actually understand what's wrong, not just that something is.
      const flagEvent = events.find((e) => e.step === 'flagged') || events[events.length - 1];
      return {
        id: r.id, subOrderId: r.sub_order_id, orderId: r.order_id,
        supplierName: r.supplier_name, hubName: r.hub_name,
        flaggedAt: r.updated_at, flagNote: flagEvent?.notes || null,
        flagPhotos: flagEvent?.photos || [],
      };
    }));
    res.json(shipments);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Hub staff: their own hub's shipments only, scoped to req.user.hubId —
// same ownership-via-WHERE-clause pattern used for suppliers.
// ============================================================

async function attachEventsAndPhotos(shipmentRow) {
  const { rows: events } = await db.query(
    `SELECT hse.*, u.email AS performed_by_email
     FROM hub_shipment_events hse LEFT JOIN users u ON u.id = hse.performed_by
     WHERE hse.shipment_id = $1 ORDER BY hse.created_at ASC`,
    [shipmentRow.id]
  );
  const eventsWithPhotos = await Promise.all(events.map(async (e) => {
    const { rows: photos } = await db.query('SELECT url FROM hub_shipment_photos WHERE event_id = $1 ORDER BY sort_order', [e.id]);
    return {
      id: e.id, step: e.step, notes: e.notes, trackingNumber: e.tracking_number,
      performedBy: e.performed_by_email, createdAt: e.created_at,
      photos: photos.map((p) => p.url),
    };
  }));
  return eventsWithPhotos;
}

router.get('/me/shipments', requireAuth, requireRole('hub_staff'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT hs.id, hs.status, hs.created_at, hs.updated_at, so.id AS sub_order_id, so.order_id, s.name AS supplier_name
       FROM hub_shipments hs
       JOIN supplier_sub_orders so ON so.id = hs.sub_order_id
       JOIN suppliers s ON s.id = so.supplier_id
       WHERE hs.hub_id = $1
       ORDER BY hs.created_at ASC`,
      [req.user.hubId]
    );
    res.json(rows.map((r) => ({
      id: r.id, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
      subOrderId: r.sub_order_id, orderId: r.order_id, supplierName: r.supplier_name,
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/me/shipments/:id', requireAuth, requireRole('hub_staff'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT hs.*, so.order_id, s.name AS supplier_name
       FROM hub_shipments hs
       JOIN supplier_sub_orders so ON so.id = hs.sub_order_id
       JOIN suppliers s ON s.id = so.supplier_id
       WHERE hs.id = $1 AND hs.hub_id = $2`,
      [req.params.id, req.user.hubId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Shipment not found' });

    const { rows: items } = await db.query(
      `SELECT oli.product_id, oli.quantity, p.name
       FROM order_line_items oli JOIN products p ON p.id = oli.product_id
       WHERE oli.sub_order_id = $1`,
      [rows[0].sub_order_id]
    );
    const events = await attachEventsAndPhotos(rows[0]);

    res.json({
      id: rows[0].id, status: rows[0].status, createdAt: rows[0].created_at, updatedAt: rows[0].updated_at,
      orderId: rows[0].order_id, supplierName: rows[0].supplier_name,
      items: items.map((i) => ({ productId: i.product_id, name: i.name, quantity: i.quantity })),
      events,
    });
  } catch (err) {
    next(err);
  }
});

// POST /hub/me/shipments/:id/events  { step, notes?, photos: [url,...], trackingNumber? }
// Advances a shipment to its next real step. Enforces:
//   - ownership (this hub's shipment only)
//   - correct step order (can't skip ahead, can't go backward)
//   - at least 1 evidence photo per step (mandatory, matching the real
//     "evidence at each step" requirement)
//   - trackingNumber required specifically for the shipped_to_buyer step
router.post('/me/shipments/:id/events', requireAuth, requireRole('hub_staff'), async (req, res, next) => {
  const { step, notes, photos, trackingNumber } = req.body || {};
  if (!step) return res.status(400).json({ error: 'step is required' });
  if (!Array.isArray(photos) || photos.length < 1) {
    return res.status(400).json({ error: 'At least 1 evidence photo is required for this step' });
  }
  if (step === 'shipped_to_buyer' && !trackingNumber) {
    return res.status(400).json({ error: 'trackingNumber is required for the shipped_to_buyer step' });
  }

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const shipCheck = await client.query('SELECT * FROM hub_shipments WHERE id = $1 AND hub_id = $2 FOR UPDATE', [req.params.id, req.user.hubId]);
    if (shipCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Shipment not found' });
    }
    const shipment = shipCheck.rows[0];

    if (step === 'flagged') {
      if (shipment.status === 'shipped_to_buyer' || shipment.status === 'flagged') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Cannot flag a shipment that is already ${shipment.status}` });
      }
    } else {
      const currentIdx = STATUS_ORDER.indexOf(shipment.status);
      const expectedNext = currentIdx >= 0 && currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null;
      if (step !== expectedNext) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: expectedNext
            ? `Out-of-order step: this shipment is at "${shipment.status}", the next valid step is "${expectedNext}", not "${step}"`
            : `This shipment is already at its final step ("${shipment.status}") and cannot be advanced further`,
        });
      }
    }

    const eventRes = await client.query(
      `INSERT INTO hub_shipment_events (shipment_id, step, notes, tracking_number, performed_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [shipment.id, step, notes || null, step === 'shipped_to_buyer' ? trackingNumber : null, req.user.sub]
    );
    const eventId = eventRes.rows[0].id;
    for (let i = 0; i < photos.length; i++) {
      await client.query('INSERT INTO hub_shipment_photos (event_id, url, sort_order) VALUES ($1, $2, $3)', [eventId, photos[i], i]);
    }
    await client.query('UPDATE hub_shipments SET status = $1, updated_at = now() WHERE id = $2', [step, shipment.id]);

    await client.query('COMMIT');
    const { rows: updated } = await db.query('SELECT * FROM hub_shipments WHERE id = $1', [shipment.id]);
    res.status(201).json({ id: updated[0].id, status: updated[0].status, updatedAt: updated[0].updated_at });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /me/shipments/:id/confirm-delivery { deliveryNote } — real
// manual delivery confirmation (migration 027, corrected from where
// this previously and incorrectly lived on the supplier's own
// endpoint). CONFIRMED design: real carrier tracking (the 17TRACK
// webhook) is the preferred, trusted path -- confirming delivery
// yourself here is a real, deliberate fallback, requiring a real short
// note explaining why (e.g. real tracking never updated), rather than
// a single click. Only valid once this shipment has genuinely reached
// 'shipped_to_buyer' -- there's no real "delivered" without a real
// completed final leg first.
router.patch('/me/shipments/:id/confirm-delivery', requireAuth, requireRole('hub_staff'), async (req, res, next) => {
  const { deliveryNote } = req.body || {};
  if (!deliveryNote || !deliveryNote.trim()) {
    return res.status(400).json({ error: 'A short note is required when manually confirming delivery yourself (e.g. why real carrier tracking didn\'t confirm it).' });
  }

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const shipCheck = await client.query('SELECT * FROM hub_shipments WHERE id = $1 AND hub_id = $2 FOR UPDATE', [req.params.id, req.user.hubId]);
    if (shipCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Shipment not found' });
    }
    const shipment = shipCheck.rows[0];
    if (shipment.status === 'delivered') {
      await client.query('ROLLBACK');
      if (shipment.delivery_confirmed_by === 'carrier') {
        return res.status(400).json({ error: 'This shipment was already confirmed delivered by real carrier tracking.' });
      }
      return res.status(400).json({ error: 'This shipment is already marked delivered.' });
    }
    if (shipment.status !== 'shipped_to_buyer') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `This shipment must reach "shipped_to_buyer" before it can be confirmed delivered (currently: "${shipment.status}").` });
    }

    const { rows } = await client.query(
      `UPDATE hub_shipments SET status = 'delivered', delivered_at = now(), delivery_confirmed_by = 'hub_manual', delivery_note = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [deliveryNote.trim(), shipment.id]
    );

    // Real trigger (matches the same real class of notification as the
    // supplier's own 'shipped' one): a real final delivery notifies the
    // real buyer.
    const { rows: subOrderRows } = await client.query('SELECT order_id FROM supplier_sub_orders WHERE id = $1', [shipment.sub_order_id]);
    const orderId = subOrderRows[0]?.order_id;
    const { rows: orderRows } = await client.query('SELECT buyer_id FROM orders WHERE id = $1', [orderId]);
    await createNotification({
      userId: orderRows[0]?.buyer_id,
      type: 'order_status',
      title: 'Your order has been delivered',
      body: `Order ${orderId} is now delivered.`,
      linkType: 'order',
      linkId: orderId,
    }, client);

    await client.query('COMMIT');

    // Real delivery notification email (new) -- deliberately AFTER the
    // commit, as a real, best-effort follow-up -- same reasoning as
    // every other real transactional email trigger.
    try {
      const { rows: orderRows2 } = await db.query('SELECT buyer_id, guest_email FROM orders WHERE id = $1', [orderId]);
      let recipientEmail = orderRows2[0]?.guest_email || null;
      let recipientName = null;
      if (orderRows2[0]?.buyer_id) {
        const { rows: userRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [orderRows2[0].buyer_id]);
        if (userRows.length > 0) { recipientEmail = userRows[0].email; recipientName = userRows[0].name; }
      }
      if (recipientEmail) {
        const { html, text } = deliveryNotificationEmail({ recipientName, orderId });
        await sendTransactionalEmail({ to: recipientEmail, subject: `Your order has been delivered — ${orderId}`, html, text, fallbackLogLabel: 'order-delivered-hub-manual' });
      }
    } catch (err) {
      console.error('Hub-confirmed delivery email failed (non-fatal):', err.message);
    }

    res.json({ id: rows[0].id, status: rows[0].status, deliveredAt: rows[0].delivered_at, deliveryConfirmedBy: rows[0].delivery_confirmed_by });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
