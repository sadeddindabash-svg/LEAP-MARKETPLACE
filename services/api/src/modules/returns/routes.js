const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, optionalAuth, requirePageAccess } = require('../auth/middleware');
const { createNotification } = require('../notifications/helpers');

/**
 * Returns/disputes module — BUY-053, SUP-030, and the admin arbitration
 * side of return/dispute handling.
 *
 * CRITICAL: this module maintains TWO SEPARATE message threads per case
 * (buyer<->admin and supplier<->admin) rather than one shared thread —
 * see the header comment in migration 007_return_cases.sql for why this
 * is a structural enforcement of the "no direct buyer<->supplier contact"
 * business rule, not just a UI choice. Every route below only ever reads
 * or writes ONE of the two message tables — there is no code path in this
 * file that could leak one party's messages to the other, even by mistake.
 *
 * ROUTE ORDERING NOTE: the /supplier/me... routes are declared BEFORE the
 * generic admin /:id routes further down. Express matches routes in
 * declaration order, and /:id would otherwise incorrectly swallow
 * /supplier/me (treating "supplier" as the :id param) — this ordering is
 * required, not stylistic.
 */
const router = express.Router();

async function nextCaseId(client) {
  const { rows } = await client.query("SELECT nextval('return_case_id_seq') AS n");
  return `RC-${rows[0].n}`;
}

function toCaseSummaryDto(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    subOrderId: row.sub_order_id,
    buyerId: row.buyer_id,
    guestEmail: row.guest_email,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSupplierCaseDto(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    subOrderId: row.sub_order_id,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// Buyer-facing: create a return request (guest checkout compatible).
// ============================================================

// POST /returns  { subOrderId, reason, message, guestEmail?, photos? }
router.post('/', optionalAuth, async (req, res, next) => {
  const { subOrderId, reason, message, guestEmail, photos } = req.body || {};
  if (!subOrderId || !reason || !message) {
    return res.status(400).json({ error: 'subOrderId, reason, and message are required' });
  }
  if (photos !== undefined && !Array.isArray(photos)) {
    return res.status(400).json({ error: 'photos must be an array of URLs if provided' });
  }
  const buyerId = req.user ? req.user.sub : null;
  if (!buyerId && !guestEmail) {
    return res.status(400).json({ error: 'guestEmail is required when not logged in' });
  }

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const subOrderCheck = await client.query(
      `SELECT so.id, so.order_id, hs.delivered_at
       FROM supplier_sub_orders so
       LEFT JOIN hub_shipments hs ON hs.sub_order_id = so.id
       WHERE so.id = $1`,
      [subOrderId]
    );
    if (subOrderCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sub-order not found' });
    }
    const orderId = subOrderCheck.rows[0].order_id;
    const deliveredAt = subOrderCheck.rows[0].delivered_at;

    // Real return window (migration 024) -- confirmed: admin-
    // configurable, 3-7 real days. Only enforced once a real delivery
    // has actually happened; an undelivered sub-order has no real
    // window to have expired yet.
    if (deliveredAt) {
      const { rows: settingRows } = await client.query("SELECT value FROM platform_settings WHERE key = 'return_window_days'");
      const windowDays = Number(settingRows[0]?.value ?? 7);
      const deadline = new Date(deliveredAt);
      deadline.setDate(deadline.getDate() + windowDays);
      if (new Date() > deadline) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `The return window (${windowDays} days after delivery) has passed for this order.` });
      }
    }

    const id = await nextCaseId(client);
    await client.query(
      `INSERT INTO return_cases (id, order_id, sub_order_id, buyer_id, guest_email, reason) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, orderId, subOrderId, buyerId, buyerId ? null : guestEmail, reason]
    );
    await client.query(
      `INSERT INTO return_case_buyer_messages (case_id, sender_role, message) VALUES ($1, 'buyer', $2)`,
      [id, message]
    );
    // Optional evidence photos (migration 043) -- deliberately optional,
    // not required: unlike a hub inspection step (mandatory photo per
    // step) or a supplier's product listing (mandatory minimum photo
    // count), a buyer's return request has no equivalent hard business
    // rule requiring one. Photos genuinely help arbitration, but
    // forcing one on, say, a "wrong item shipped" claim where the
    // packing slip alone tells the whole story would be friction with
    // no real benefit.
    if (Array.isArray(photos) && photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        await client.query('INSERT INTO return_case_photos (case_id, url, sort_order) VALUES ($1, $2, $3)', [id, photos[i], i]);
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ id, orderId, subOrderId, reason, status: 'awaiting' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ============================================================
// Supplier-facing (declared BEFORE the admin /:id routes — see note above).
// Only ever touches the supplier<->admin thread for cases tied to their
// own sub-orders. Never sees the buyer's thread or identity.
// ============================================================

router.get('/supplier/me', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT rc.* FROM return_cases rc
       JOIN supplier_sub_orders so ON so.id = rc.sub_order_id
       WHERE so.supplier_id = $1
       ORDER BY rc.updated_at DESC`,
      [req.user.supplierId]
    );
    res.json(rows.map(toSupplierCaseDto));
  } catch (err) {
    next(err);
  }
});

router.get('/supplier/me/:id', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT rc.* FROM return_cases rc
       JOIN supplier_sub_orders so ON so.id = rc.sub_order_id
       WHERE rc.id = $1 AND so.supplier_id = $2`,
      [req.params.id, req.user.supplierId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Return case not found' });

    const { rows: supplierMessages } = await db.query(
      'SELECT sender_role, message, created_at FROM return_case_supplier_messages WHERE case_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({
      ...toSupplierCaseDto(rows[0]),
      messages: supplierMessages.map((m) => ({ senderRole: m.sender_role, message: m.message, createdAt: m.created_at })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /returns/supplier/me/:id/messages — supplier replies to admin.
router.post('/supplier/me/:id/messages', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });

    const ownershipCheck = await db.query(
      `SELECT rc.id FROM return_cases rc
       JOIN supplier_sub_orders so ON so.id = rc.sub_order_id
       WHERE rc.id = $1 AND so.supplier_id = $2`,
      [req.params.id, req.user.supplierId]
    );
    if (ownershipCheck.rows.length === 0) return res.status(404).json({ error: 'Return case not found' });

    await db.query(`INSERT INTO return_case_supplier_messages (case_id, sender_role, message) VALUES ($1, 'supplier', $2)`, [req.params.id, message]);
    await db.query('UPDATE return_cases SET updated_at = now() WHERE id = $1', [req.params.id]);
    res.status(201).json({ senderRole: 'supplier', message });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Buyer-facing: view and continue your OWN return cases (login required).
// Declared BEFORE the generic admin /:id routes below, for the same
// reason /supplier/me... is — otherwise /my-cases would be swallowed by
// /:id. Symmetric with the supplier-facing view: a buyer here sees ONLY
// their own buyer<->admin thread, never the supplier<->admin thread —
// same structural isolation, enforced in the other direction.
// ============================================================

router.get('/my-cases', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM return_cases WHERE buyer_id = $1 ORDER BY updated_at DESC', [req.user.sub]);
    res.json(rows.map(toCaseSummaryDto));
  } catch (err) {
    next(err);
  }
});

// GET /returns/my-cases/:id — real gap closed here: previously
// requireAuth only, so a guest who filed a return (POST / above
// supports guestEmail) could never check on it again. Now optionalAuth,
// matching the EXACT security pattern GET /order/:id already uses: a
// logged-in buyer sees their own case as before, OR a guest supplying
// the real ?guestEmail= this case was actually filed under (a second
// factor beyond just knowing the case ID, same reasoning as the order
// module's own header comment).
router.get('/my-cases/:id', optionalAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM return_cases WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Return case not found' });
    const caseRow = rows[0];

    const isOwningBuyer = req.user && caseRow.buyer_id && req.user.sub === caseRow.buyer_id;
    const guestEmailMatches = caseRow.guest_email && req.query.guestEmail && req.query.guestEmail === caseRow.guest_email;
    if (!isOwningBuyer && !guestEmailMatches) return res.status(404).json({ error: 'Return case not found' });

    const { rows: buyerMessages } = await db.query(
      'SELECT sender_role, message, created_at FROM return_case_buyer_messages WHERE case_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    const { rows: photoRows } = await db.query('SELECT url FROM return_case_photos WHERE case_id = $1 ORDER BY sort_order', [req.params.id]);
    // Deliberately NOT including supplierMessages here — see header note.
    res.json({
      ...toCaseSummaryDto(caseRow),
      messages: buyerMessages.map((m) => ({ senderRole: m.sender_role, message: m.message, createdAt: m.created_at })),
      photos: photoRows.map((p) => p.url),
    });
  } catch (err) {
    next(err);
  }
});

// POST /returns/my-cases/:id/messages  { message, guestEmail? } — buyer
// OR guest (matching email) follows up on their own case. Same
// optionalAuth + guestEmail-match pattern as the GET above.
router.post('/my-cases/:id/messages', optionalAuth, async (req, res, next) => {
  try {
    const { message, guestEmail } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });

    const { rows } = await db.query('SELECT * FROM return_cases WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Return case not found' });
    const caseRow = rows[0];

    const isOwningBuyer = req.user && caseRow.buyer_id && req.user.sub === caseRow.buyer_id;
    const guestEmailMatches = caseRow.guest_email && guestEmail && guestEmail === caseRow.guest_email;
    if (!isOwningBuyer && !guestEmailMatches) return res.status(404).json({ error: 'Return case not found' });

    await db.query(`INSERT INTO return_case_buyer_messages (case_id, sender_role, message) VALUES ($1, 'buyer', $2)`, [req.params.id, message]);
    await db.query('UPDATE return_cases SET updated_at = now() WHERE id = $1', [req.params.id]);
    res.status(201).json({ senderRole: 'buyer', message });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Admin-facing: full arbitration — sees both threads, sets status.
// These generic /:id routes MUST come after /supplier/me... and
// /my-cases... above.
// ============================================================

router.get('/', requireAuth, requireRole('admin'), requirePageAccess('returns'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM return_cases ORDER BY updated_at DESC');
    res.json(rows.map(toCaseSummaryDto));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, requireRole('admin'), requirePageAccess('returns'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM return_cases WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Return case not found' });

    const { rows: buyerMessages } = await db.query(
      'SELECT sender_role, message, created_at FROM return_case_buyer_messages WHERE case_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    const { rows: supplierMessages } = await db.query(
      'SELECT sender_role, message, created_at FROM return_case_supplier_messages WHERE case_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    const { rows: photoRows } = await db.query('SELECT url FROM return_case_photos WHERE case_id = $1 ORDER BY sort_order', [req.params.id]);
    res.json({
      ...toCaseSummaryDto(rows[0]),
      buyerMessages: buyerMessages.map((m) => ({ senderRole: m.sender_role, message: m.message, createdAt: m.created_at })),
      supplierMessages: supplierMessages.map((m) => ({ senderRole: m.sender_role, message: m.message, createdAt: m.created_at })),
      photos: photoRows.map((p) => p.url),
    });
  } catch (err) {
    next(err);
  }
});

// POST /returns/:id/buyer-messages — admin replies to the buyer.
router.post('/:id/buyer-messages', requireAuth, requireRole('admin'), requirePageAccess('returns'), async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });
    const caseCheck = await db.query('SELECT id FROM return_cases WHERE id = $1', [req.params.id]);
    if (caseCheck.rows.length === 0) return res.status(404).json({ error: 'Return case not found' });

    await db.query(`INSERT INTO return_case_buyer_messages (case_id, sender_role, message) VALUES ($1, 'admin', $2)`, [req.params.id, message]);
    await db.query('UPDATE return_cases SET updated_at = now() WHERE id = $1', [req.params.id]);
    res.status(201).json({ senderRole: 'admin', message });
  } catch (err) {
    next(err);
  }
});

// POST /returns/:id/supplier-messages — admin messages the supplier.
router.post('/:id/supplier-messages', requireAuth, requireRole('admin'), requirePageAccess('returns'), async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });
    const caseCheck = await db.query('SELECT id FROM return_cases WHERE id = $1', [req.params.id]);
    if (caseCheck.rows.length === 0) return res.status(404).json({ error: 'Return case not found' });

    await db.query(`INSERT INTO return_case_supplier_messages (case_id, sender_role, message) VALUES ($1, 'admin', $2)`, [req.params.id, message]);
    await db.query('UPDATE return_cases SET updated_at = now() WHERE id = $1', [req.params.id]);
    res.status(201).json({ senderRole: 'admin', message });
  } catch (err) {
    next(err);
  }
});

// PATCH /returns/:id  { status }
router.patch('/:id', requireAuth, requireRole('admin'), requirePageAccess('returns'), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['awaiting', 'in_progress', 'approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ error: "status must be one of: awaiting, in_progress, approved, rejected, completed" });
    }
    const { rows } = await db.query(
      `UPDATE return_cases SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Return case not found' });

    // Real trigger #2 (of the 4 confirmed for notifications — see
    // migration 019's header comment): a real return case status
    // change notifies the real buyer. Skipped for a guest return case
    // (buyer_id is null) -- no real account to attach a notification to.
    // Links to the real ORDER, not the return case itself -- the mobile
    // app has a real order detail screen showing the return request
    // inline, but no separate return-case-specific screen to navigate to.
    await createNotification({
      userId: rows[0].buyer_id,
      type: 'return_status',
      title: 'Your return request was updated',
      body: `Return ${rows[0].id} is now ${status}.`,
      linkType: 'order',
      linkId: rows[0].order_id,
    });

    res.json(toCaseSummaryDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
