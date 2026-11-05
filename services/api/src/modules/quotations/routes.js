const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { createNotification } = require('../notifications/helpers');
const service = require('./service');

/**
 * "Get a quotation" (migration 124). The rules are in service.js; this file only checks who may do what.
 *
 *   POST /quotations                          signed-in buyer: creates one from the parts they chose (their cart selection)
 *   GET  /quotations/me                       signed-in buyer: My quotations
 *   GET  /quotations/me/:id                   signed-in buyer: one of theirs, with the link to share
 *   POST /quotations/me/:id/renew             signed-in buyer: a new quotation, same parts and party, at today's prices
 *   GET  /quotations/public/:code             anyone with the code: check it (genuine, valid until) and see what each party pays
 *   POST /quotations/public/:code/shares/:id  anyone with the code: confirm a share (name, email, payment method); the last one places the order
 *   GET  /quotations/admin                    admin: every quotation, newest first, and how many became orders
 *   GET|PUT /quotations/supplier-settings     a seller: how many days its prices hold on a quotation
 */
const router = express.Router();

const STOREFRONT = () => (process.env.STOREFRONT_URL || 'http://localhost:3001').replace(/\/$/, '');
const linkFor = (code, lang) => `${STOREFRONT()}${lang === 'ar' ? '/ar' : ''}/q/${service.readCode(code)}`;

async function qrFor(url) {
  try { return await require('qrcode').toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 240 }); } catch { return null; }
}

function sendError(res, next, err) {
  if (err && err.status) return res.status(err.status).json({ error: err.message, ...(err.apiCode ? { code: err.apiCode } : {}) });
  return next(err);
}

async function inTransaction(work) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const langOf = (req) => (req.query.lang === 'ar' ? 'ar' : 'en');

// Which of these parts fit the car (the quotation's parts step, and the basket's parts brought into a quotation): { vehicle: { generationId, year, versionId? },
// productIds } -> { fits: [productId] }. Read only.
router.post('/fit-check', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const fits = await service.fittingProductIds(db, body.vehicle, body.productIds);
    res.json({ fits: [...fits] });
  } catch (err) { sendError(res, next, err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const id = await inTransaction((client) => service.createQuotation(client, req.user.sub, req.body || {}));
    const full = await service.loadFull(db, 'id', id);
    const dto = service.toDto(full, { lang: langOf(req), forBuyer: true });
    res.status(201).json({ ...dto, link: linkFor(full.quote.code, full.quote.lang) });
  } catch (err) { sendError(res, next, err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT q.*, (SELECT COUNT(*)::int FROM quotation_items i WHERE i.quotation_id = q.id) AS item_count
       FROM quotations q WHERE q.buyer_id = $1 ORDER BY q.created_at DESC LIMIT 200`,
      [req.user.sub]
    );
    res.json(rows.map((q) => ({
      id: q.id, code: service.showCode(q.code), state: service.stateOf(q), createdAt: new Date(q.created_at).toISOString(), expiresAt: new Date(q.expires_at).toISOString(),
      party: { type: q.party_type, name: q.party_name }, vehicle: typeof q.vehicle === 'string' ? JSON.parse(q.vehicle) : q.vehicle,
      itemCount: Number(q.item_count), totalUsd: Number(q.total_usd), currency: { code: q.display_currency, rate: Number(q.display_rate) }, orderId: q.order_id,
    })));
  } catch (err) { next(err); }
});

router.get('/me/:id', requireAuth, async (req, res, next) => {
  try {
    const full = await service.loadFull(db, 'id', req.params.id);
    if (!full || full.quote.buyer_id !== req.user.sub) return res.status(404).json({ error: 'Quotation not found.' });
    const link = linkFor(full.quote.code, full.quote.lang);
    res.json({ ...service.toDto(full, { lang: langOf(req), forBuyer: true }), link, qr: await qrFor(link) });
  } catch (err) { next(err); }
});

router.post('/me/:id/renew', requireAuth, async (req, res, next) => {
  try {
    const old = await service.loadFull(db, 'id', req.params.id);
    if (!old || old.quote.buyer_id !== req.user.sub) return res.status(404).json({ error: 'Quotation not found.' });
    const q = old.quote;
    const json = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
    const id = await inTransaction((client) => service.createQuotation(client, req.user.sub, {
      items: old.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
      vehicle: json(q.vehicle), partyType: q.party_type, partyName: q.party_name, policyNumber: q.policy_number, reportNumber: q.report_number,
      shares: old.shares.map((s) => ({ payer: s.payer, percent: Number(s.percent) })), addressCopy: json(q.address), lang: q.lang,
      displayCurrency: (req.body && req.body.displayCurrency) || q.display_currency, renewedFrom: q.id,
    }));
    const full = await service.loadFull(db, 'id', id);
    res.status(201).json({ ...service.toDto(full, { lang: langOf(req), forBuyer: true }), link: linkFor(full.quote.code, full.quote.lang) });
  } catch (err) { sendError(res, next, err); }
});

router.get('/public/:code', async (req, res, next) => {
  try {
    const full = await service.loadFull(db, 'code', service.readCode(req.params.code));
    if (!full) return res.status(404).json({ error: 'Quotation not found.', code: 'quote_not_found' });
    // counts the opens of the link (the buyer's own views through /me do not count)
    if (req.query.count !== '0') db.query('UPDATE quotations SET open_count = open_count + 1, last_opened_at = now() WHERE id = $1', [full.quote.id]).catch(() => {});
    const { rows } = await db.query('SELECT name FROM users WHERE id = $1', [full.quote.buyer_id]);
    const link = linkFor(full.quote.code, full.quote.lang);
    res.json({ ...service.toDto(full, { lang: langOf(req) }), buyerName: rows[0] ? rows[0].name : null, link, qr: await qrFor(link) });
  } catch (err) { next(err); }
});

router.post('/public/:code/shares/:shareId', async (req, res, next) => {
  try {
    const result = await inTransaction((client) => service.confirmShare(client, req.params.code, req.params.shareId, req.body || {}));
    const full = await service.loadFull(db, 'code', service.readCode(req.params.code));
    if (result.orderId) {
      createNotification({
        userId: full.quote.buyer_id, type: 'order_status',
        title: `Quotation ${full.quote.id} is now order ${result.orderId}`, body: 'Every share is confirmed, so your parts are ordered.',
        titleAr: `أصبح عرض السعر ${full.quote.id} الطلب ${result.orderId}`, bodyAr: 'تم تأكيد جميع الحصص، فتم طلب قطعك.',
        linkType: 'order', linkId: result.orderId,
      }).catch(() => {});
    } else {
      createNotification({
        userId: full.quote.buyer_id, type: 'order_status',      // the notification types are fixed (migration 039); this is about a coming order
        title: `A share of quotation ${full.quote.id} is confirmed`, body: 'The order is placed when every share is confirmed.',
        titleAr: `تم تأكيد حصة من عرض السعر ${full.quote.id}`, bodyAr: 'يُنشأ الطلب عند تأكيد جميع الحصص.',
      }).catch(() => {});
    }
    const { rows } = await db.query('SELECT name FROM users WHERE id = $1', [full.quote.buyer_id]);
    const link = linkFor(full.quote.code, full.quote.lang);
    res.json({ ...service.toDto(full, { lang: langOf(req) }), buyerName: rows[0] ? rows[0].name : null, link, qr: await qrFor(link), orderPlaced: Boolean(result.orderId) });
  } catch (err) { sendError(res, next, err); }
});

// A seller's own setting: how many days its prices hold on a quotation (1 to 90; empty = the default, 7).
router.get('/supplier-settings', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT quote_validity_days FROM suppliers WHERE id = $1', [req.user.supplierId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found.' });
    res.json({ quoteValidityDays: rows[0].quote_validity_days === null ? null : Number(rows[0].quote_validity_days), defaultDays: service.DEFAULT_VALIDITY_DAYS });
  } catch (err) { next(err); }
});
router.put('/supplier-settings', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const raw = req.body ? req.body.quoteValidityDays : undefined;
    const days = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    if (days !== null && !(Number.isInteger(days) && days >= 1 && days <= 90)) return res.status(400).json({ error: 'Enter a whole number of days from 1 to 90, or leave it empty for the default.', code: 'quote_validity_days' });
    await db.query('UPDATE suppliers SET quote_validity_days = $1 WHERE id = $2', [days, req.user.supplierId]);
    res.json({ quoteValidityDays: days, defaultDays: service.DEFAULT_VALIDITY_DAYS });
  } catch (err) { next(err); }
});

router.get('/admin', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT q.id, q.party_type, q.party_name, q.total_usd, q.status, q.expires_at, q.order_id, q.open_count, q.created_at, u.name AS buyer_name, u.email AS buyer_email
       FROM quotations q LEFT JOIN users u ON u.id = q.buyer_id ORDER BY q.created_at DESC LIMIT 500`
    );
    const list = rows.map((q) => ({
      id: q.id, state: service.stateOf(q), partyType: q.party_type, partyName: q.party_name, totalUsd: Number(q.total_usd), orderId: q.order_id,
      openCount: Number(q.open_count), createdAt: new Date(q.created_at).toISOString(), buyer: { name: q.buyer_name, email: q.buyer_email },
    }));
    const ordered = list.filter((q) => q.state === 'ordered').length;
    res.json({ quotations: list, total: list.length, ordered, conversionPercent: list.length ? Math.round((ordered / list.length) * 100) : 0 });
  } catch (err) { next(err); }
});

module.exports = router;
