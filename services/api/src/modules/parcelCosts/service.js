const { calculateBuyerPriceUsd } = require('../pricing/engine');
const { withEffectiveShipping } = require('../shared/partShipping');
const { startOf, step, label, KINDS } = require('../profits/service');

/**
 * What each parcel REALLY cost to ship (migration 127). The inspection hub enters it before it ships the parcel to the buyer, in its own
 * currency; it is converted to dollars at the day's rate and compared with the PLANNED cost: the shipping already inside the parts' prices
 * (the pricing engine's shipping fee, kept on each order line at checkout; for an older order, worked out from today's Pricing).
 *
 *   within +-2% of planned  -> equal   may ship
 *   cheaper                 -> saved   may ship; the difference is extra profit
 *   dearer                  -> over    the hub adds a photo of the parcel with its size and weight written on it, then it waits for an admin:
 *                                      approved -> may ship, the difference is extra cost;  sent back -> the hub enters it again
 *
 * The hub never sees an amount after typing it, nor the planned cost: only whether it may ship. Only admin routes return amounts.
 */
const TOLERANCE = 0.02;
const CURRENCIES = ['USD', 'JOD', 'SAR', 'AED', 'CNY', 'EUR', 'KWD', 'QAR', 'BHD', 'OMR', 'EGP'];
const MAY_SHIP = ['cleared', 'approved'];
const TZ = 'Asia/Riyadh';

class ParcelCostError extends Error {
  constructor(message, status = 400, code = undefined) { super(message); this.status = status; this.code = code; }
}
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** How many dollars one unit of `currency` is worth today: CNY from the pricing rate (CNY_USD), others from the display rates (USD_XXX). */
async function rateToUsd(db, currency) {
  if (currency === 'USD') return 1;
  if (currency === 'CNY') {
    const { rows } = await db.query("SELECT rate FROM fx_rates WHERE currency_pair = 'CNY_USD'");
    if (rows.length && Number(rows[0].rate) > 0) return Number(rows[0].rate);
  } else {
    const { rows } = await db.query('SELECT rate FROM fx_rates WHERE currency_pair = $1', [`USD_${currency}`]);
    if (rows.length && Number(rows[0].rate) > 0) return 1 / Number(rows[0].rate);
  }
  throw new ParcelCostError(`There is no exchange rate for ${currency} yet. Ask Leap to add it (Admin → Financial → Pricing).`, 400, 'no_rate');
}

/** The planned shipping of a parcel: the shipping inside its lines' prices. { usd: number|null, estimated } -- null when it cannot be worked out. */
async function plannedFor(db, shipmentId) {
  const { rows } = await db.query(
    `SELECT oli.quantity, oli.shipping_planned_usd, p.*
     FROM hub_shipments hs JOIN order_line_items oli ON oli.sub_order_id = hs.sub_order_id JOIN products p ON p.id = oli.product_id
     WHERE hs.id = $1`, [shipmentId]
  );
  if (rows.length === 0) return { usd: null, estimated: false };
  let total = 0; let estimated = false;
  for (const row of rows) {
    if (row.shipping_planned_usd !== null && row.shipping_planned_usd !== undefined) { total += Number(row.shipping_planned_usd) * row.quantity; continue; }
    // an order from before migration 127: today's Pricing, for this product's weight and size
    estimated = true;
    try {
      if (row.currency_code !== 'CNY') return { usd: null, estimated };
      const shipped = await withEffectiveShipping(row, db);
      const n = (v) => (v === null || v === undefined ? null : Number(v));
      const result = await calculateBuyerPriceUsd({ supplierCostCny: Number(row.price), weightKg: n(shipped.weight_kg), lengthCm: n(shipped.length_cm), widthCm: n(shipped.width_cm), heightCm: n(shipped.height_cm) });
      const cny = result.breakdown.filter((b) => b.type === 'shipping_volumetric').reduce((s, b) => s + b.amountCny, 0);
      total += cny * result.fxRate * row.quantity;
    } catch {
      return { usd: null, estimated };
    }
  }
  return { usd: r2(total), estimated };
}

/** equal / saved / over, by the +-2% rule. No planned cost (it could not be worked out) counts as over: an admin decides. */
function classify(plannedUsd, paidUsd) {
  if (plannedUsd === null || plannedUsd === undefined || !(plannedUsd > 0)) return 'over';
  const diff = paidUsd - plannedUsd;
  if (Math.abs(diff) <= plannedUsd * TOLERANCE + 1e-9) return 'equal';
  return diff < 0 ? 'saved' : 'over';
}

// What the hub may see: never an amount.
function hubView(row) {
  if (!row) return { state: 'missing', mayShip: false };
  return {
    state: row.state, mayShip: MAY_SHIP.includes(row.state), carrier: row.carrier,
    needsParcelPhoto: row.state === 'needs_photo',
    adminNote: row.state === 'sent_back' ? row.admin_note || null : null,
  };
}

async function shipmentOfHub(db, shipmentId, hubId) {
  const { rows } = await db.query('SELECT id, status, hub_id FROM hub_shipments WHERE id = $1 AND hub_id = $2', [shipmentId, hubId]);
  if (rows.length === 0) throw new ParcelCostError('Shipment not found', 404);
  return rows[0];
}

async function hubStatus(db, { shipmentId, hubId }) {
  await shipmentOfHub(db, shipmentId, hubId);
  const { rows } = await db.query('SELECT * FROM hub_parcel_costs WHERE shipment_id = $1', [shipmentId]);
  const { rows: last } = await db.query(
    `SELECT pc.currency FROM hub_parcel_costs pc JOIN hub_shipments hs ON hs.id = pc.shipment_id WHERE hs.hub_id = $1 ORDER BY pc.entered_at DESC LIMIT 1`, [hubId]
  );
  return { ...hubView(rows[0]), lastCurrency: last[0]?.currency || null, currencies: CURRENCIES };
}

/**
 * The hub saves the cost (or, for a dearer parcel, its photo). Only while the parcel is packed and not shipped; once saved it cannot be changed
 * by the hub (an admin can send it back).
 */
async function hubSave(db, { shipmentId, hubId, userId, body }) {
  const shipment = await shipmentOfHub(db, shipmentId, hubId);
  if (shipment.status !== 'packed') throw new ParcelCostError('The shipping cost is entered once the parcel is packed, before it is shipped.', 400, 'not_packed');
  const { rows: existingRows } = await db.query('SELECT * FROM hub_parcel_costs WHERE shipment_id = $1', [shipmentId]);
  const existing = existingRows[0];
  const parcelPhoto = typeof body.parcelPhoto === 'string' && body.parcelPhoto.trim() ? body.parcelPhoto.trim() : null;

  if (existing && existing.state === 'needs_photo') {
    if (!parcelPhoto) throw new ParcelCostError('Add a photo of the parcel with its size and weight written on it.', 400, 'parcel_photo_required');
    const { rows } = await db.query(`UPDATE hub_parcel_costs SET parcel_photo = $1, state = 'waiting' WHERE id = $2 RETURNING *`, [parcelPhoto, existing.id]);
    return hubView(rows[0]);
  }
  if (existing && existing.state !== 'sent_back') throw new ParcelCostError('The shipping cost of this parcel is already recorded.', 409, 'already_recorded');

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new ParcelCostError('Enter what you paid the carrier, a number above 0.', 400, 'bad_amount');
  const currency = String(body.currency || '').toUpperCase();
  if (!CURRENCIES.includes(currency)) throw new ParcelCostError(`currency must be one of: ${CURRENCIES.join(', ')}`, 400, 'bad_currency');
  const carrier = String(body.carrier || '').trim();
  if (!carrier || carrier.length > 60) throw new ParcelCostError('Enter the carrier (for example Aramex).', 400, 'bad_carrier');
  const receiptPhoto = typeof body.receiptPhoto === 'string' && body.receiptPhoto.trim() ? body.receiptPhoto.trim() : null;

  const rate = await rateToUsd(db, currency);
  const amountUsd = r2(amount * rate);
  const planned = await plannedFor(db, shipmentId);
  const result = classify(planned.usd, amountUsd);
  const state = result !== 'over' ? 'cleared' : parcelPhoto ? 'waiting' : 'needs_photo';
  const values = [shipmentId, r2(amount), currency, rate, amountUsd, planned.usd, planned.estimated, carrier, receiptPhoto, parcelPhoto, result, state, userId];
  const { rows } = existing
    ? await db.query(
      `UPDATE hub_parcel_costs SET amount = $2, currency = $3, rate_to_usd = $4, amount_usd = $5, planned_usd = $6, planned_estimated = $7, carrier = $8, receipt_photo = $9,
              parcel_photo = $10, result = $11, state = $12, entered_by = $13, entered_at = now(), decided_by = NULL, decided_at = NULL
       WHERE shipment_id = $1 RETURNING *`, values)
    : await db.query(
      `INSERT INTO hub_parcel_costs (shipment_id, amount, currency, rate_to_usd, amount_usd, planned_usd, planned_estimated, carrier, receipt_photo, parcel_photo, result, state, entered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`, values);
  return hubView(rows[0]);
}

/** Whether the parcel may be shipped to the buyer (the hub's "Shipped to buyer" step asks this). */
async function shipCheck(db, shipmentId) {
  const { rows } = await db.query('SELECT state FROM hub_parcel_costs WHERE shipment_id = $1', [shipmentId]);
  const state = rows[0]?.state;
  if (MAY_SHIP.includes(state)) return { allowed: true };
  if (!state || state === 'sent_back') return { allowed: false, code: 'shipping_cost_required', error: 'Enter what you paid the carrier for this parcel first (the Shipping cost step).' };
  if (state === 'needs_photo') return { allowed: false, code: 'parcel_photo_required', error: 'Add a photo of the parcel with its size and weight written on it first.' };
  return { allowed: false, code: 'shipping_cost_waiting', error: "This parcel waits for Leap's approval of its shipping cost. Do not ship it yet." };
}

// ---- admin
const ADMIN_SELECT = `
  SELECT pc.*, hs.status AS shipment_status, so.order_id, h.name AS hub_name, eu.name AS entered_by_name, eu.email AS entered_by_email,
         du.name AS decided_by_name, du.email AS decided_by_email,
         (SELECT COALESCE(SUM(COALESCE(p.weight_kg, 0) * oli.quantity), 0) FROM order_line_items oli JOIN products p ON p.id = oli.product_id WHERE oli.sub_order_id = hs.sub_order_id) AS weight_kg,
         to_char(pc.entered_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI:SS') AS entered_local
  FROM hub_parcel_costs pc
  JOIN hub_shipments hs ON hs.id = pc.shipment_id
  JOIN supplier_sub_orders so ON so.id = hs.sub_order_id
  LEFT JOIN hubs h ON h.id = hs.hub_id
  LEFT JOIN users eu ON eu.id = pc.entered_by
  LEFT JOIN users du ON du.id = pc.decided_by`;

function adminDto(row) {
  const planned = row.planned_usd === null ? null : Number(row.planned_usd);
  const paid = Number(row.amount_usd);
  return {
    id: row.id, shipmentId: row.shipment_id, orderId: row.order_id, hubName: row.hub_name || null, carrier: row.carrier,
    weightKg: Number(row.weight_kg) || null, enteredAt: row.entered_at, enteredDay: String(row.entered_local).slice(0, 10),
    enteredBy: row.entered_by_name || row.entered_by_email || null,
    amount: Number(row.amount), currency: row.currency, paidUsd: paid, plannedUsd: planned, plannedEstimated: row.planned_estimated,
    differenceUsd: planned === null ? null : r2(paid - planned), result: row.result, state: row.state,
    receiptPhoto: row.receipt_photo, parcelPhoto: row.parcel_photo,
    decidedBy: row.decided_by_name || row.decided_by_email || null, decidedAt: row.decided_at, adminNote: row.admin_note,
  };
}

const local = (text) => new Date(`${String(text).slice(0, 19).replace(' ', 'T')}Z`);
const ts = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const iso = (d) => d.toISOString().slice(0, 10);

// The money of a set of parcels. The shipping result counts only parcels that may ship (a waiting one is not decided yet).
function totalsOf(list) {
  const counted = list.filter((p) => MAY_SHIP.includes(p.state));
  const sum = (xs, f) => r2(xs.reduce((s, x) => s + f(x), 0));
  const known = counted.filter((p) => p.plannedUsd !== null);
  const saved = counted.filter((p) => p.result === 'saved');
  const over = counted.filter((p) => p.result === 'over');
  return {
    // planned and paid: every parcel in the list; the result: only the decided ones (a waiting parcel may still be sent back)
    parcels: list.length, plannedUsd: sum(list.filter((p) => p.plannedUsd !== null), (p) => p.plannedUsd), paidUsd: sum(list, (p) => p.paidUsd),
    shippingResultUsd: sum(known, (p) => p.plannedUsd - p.paidUsd),
    equal: counted.filter((p) => p.result === 'equal').length,
    saved: { parcels: saved.length, usd: sum(saved.filter((p) => p.plannedUsd !== null), (p) => p.plannedUsd - p.paidUsd) },
    over: { parcels: over.length, usd: sum(over.filter((p) => p.plannedUsd !== null), (p) => p.paidUsd - p.plannedUsd) },
    waiting: list.filter((p) => !MAY_SHIP.includes(p.state)).length,
  };
}

/** Every parcel cost entered in the period (Riyadh time, weeks Saturday to Friday), the totals, and every parcel still waiting for an admin. */
async function adminReport(db, { kind = 'month', date } = {}) {
  if (!KINDS.includes(kind)) throw new ParcelCostError(`period must be one of: ${KINDS.join(', ')}`);
  const { rows: [clock] } = await db.query(`SELECT to_char(now() AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI:SS') AS now_local`);
  const now = local(clock.now_local);
  let day = now;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(local(`${date}T00:00:00`).getTime())) throw new ParcelCostError('date must be YYYY-MM-DD');
    day = local(`${date}T00:00:00`);
  }
  const start = startOf(kind, day);
  const end = step(kind, start);
  const { rows } = await db.query(`${ADMIN_SELECT} WHERE pc.entered_at AT TIME ZONE '${TZ}' >= $1::timestamp AND pc.entered_at AT TIME ZONE '${TZ}' < $2::timestamp ORDER BY pc.entered_at DESC`, [ts(start), ts(end)]);
  const parcels = rows.map(adminDto);
  const { rows: waitingRows } = await db.query(`${ADMIN_SELECT} WHERE pc.state IN ('needs_photo', 'waiting') ORDER BY pc.entered_at ASC`);
  return {
    kind, start: iso(start), label: label(kind, start), running: now >= start && now < end,
    totals: totalsOf(parcels), parcels, waiting: waitingRows.map(adminDto), tolerancePercent: TOLERANCE * 100,
  };
}

async function decide(db, { id, adminId, approve, note }) {
  const { rows } = await db.query('SELECT * FROM hub_parcel_costs WHERE id = $1', [id]);
  const row = rows[0];
  if (!row) throw new ParcelCostError('Not found', 404);
  if (approve && row.state !== 'waiting') throw new ParcelCostError(row.state === 'needs_photo' ? 'The hub has not added the parcel photo yet.' : 'Only a parcel waiting for approval can be approved.', 409);
  if (!approve && !['waiting', 'needs_photo'].includes(row.state)) throw new ParcelCostError('Only a parcel waiting for approval can be sent back.', 409);
  const text = note === undefined || note === null ? null : String(note).trim().slice(0, 500) || null;
  const { rows: updated } = await db.query(
    `UPDATE hub_parcel_costs SET state = $2, decided_by = $3, decided_at = now(), admin_note = $4 WHERE id = $1 RETURNING *`,
    [id, approve ? 'approved' : 'sent_back', adminId, text]
  );
  return updated[0];
}

async function waitingCount(db) {
  const { rows } = await db.query("SELECT COUNT(*) AS n FROM hub_parcel_costs WHERE state IN ('needs_photo', 'waiting')");
  return Number(rows[0].n);
}

module.exports = { TOLERANCE, CURRENCIES, MAY_SHIP, ParcelCostError, rateToUsd, plannedFor, classify, hubView, hubStatus, hubSave, shipCheck, adminReport, adminDto, totalsOf, decide, waitingCount };
