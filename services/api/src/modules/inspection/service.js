/**
 * The inspection list (migration 129): ONE list for each item, built here, so the hub portal and the hub app always show the same lines:
 *   the part, its OEM number, its position (when it has one and no "Position" spec), each of its specs, and a fixed line for its condition.
 * The hub ticks each line against the real part; the ticks are saved on the order line, so work started on the app can be finished on the portal.
 *
 * "Confirm Inspected" (the 'inspected' step) is refused until, for every item:
 *   - every line of its list is ticked, and
 *   - its received quantity is entered, and
 *   - the received quantity equals the ordered quantity. A different quantity must be FLAGGED; it may go on only after Leap reviewed the flag and
 *     chose "continue processing" (the shipment then comes back to this step with that resolution).
 */
const CONDITION = { key: 'condition', en: 'Condition: no damage, sealed box', zh: '外观：无损坏，包装完好' };
const clean = (v) => (v === null || v === undefined ? '' : String(v).trim());

class InspectionError extends Error {
  constructor(message, status = 400, code = undefined) { super(message); this.status = status; this.code = code; }
}

/** The list for one item: [{ key, en, zh }]. `item`: { part, oemNumber, position, attributes: [{ name, value }] }. */
function checklistFor(item) {
  const list = [];
  const part = clean(item.part); const oem = clean(item.oemNumber); const position = clean(item.position);
  const attributes = (item.attributes || []).filter((a) => clean(a.name) && clean(a.value));
  if (part) list.push({ key: 'part', en: `Part: ${part}`, zh: `配件：${part}` });
  if (oem) list.push({ key: 'oem', en: `OEM: ${oem}`, zh: `OEM：${oem}` });
  if (position && !attributes.some((a) => clean(a.name).toLowerCase() === 'position')) list.push({ key: 'position', en: `Position: ${position}`, zh: `位置：${position}` });
  for (const a of attributes) list.push({ key: `attr:${clean(a.name)}`, en: `${clean(a.name)}: ${clean(a.value)}`, zh: `${clean(a.name)}：${clean(a.value)}` });
  list.push({ ...CONDITION });
  return list;
}

const checkedOf = (raw) => (Array.isArray(raw) ? raw.filter((k) => typeof k === 'string') : []);

/** The items of a sub-order, each with its list and the ticks saved for it. */
async function itemsOf(db, subOrderId) {
  const { rows } = await db.query(
    `SELECT oli.product_id, oli.quantity, oli.received_quantity, oli.inspection_checks, p.name, p.part, p.position, p.oem_number
     FROM order_line_items oli JOIN products p ON p.id = oli.product_id WHERE oli.sub_order_id = $1 ORDER BY oli.product_id`, [subOrderId]
  );
  const out = [];
  for (const r of rows) {
    const { rows: attrs } = await db.query('SELECT attribute_name, attribute_value FROM product_attributes WHERE product_id = $1 ORDER BY attribute_name', [r.product_id]);
    const item = { part: r.part, oemNumber: r.oem_number, position: r.position, attributes: attrs.map((a) => ({ name: a.attribute_name, value: a.attribute_value })) };
    const checklist = checklistFor(item);
    const keys = new Set(checklist.map((c) => c.key));
    out.push({ productId: r.product_id, name: r.name, quantity: r.quantity, receivedQuantity: r.received_quantity, checklist, checkedKeys: checkedOf(r.inspection_checks).filter((k) => keys.has(k)) });
  }
  return out;
}

/** What is still missing for each item: [{ productId, name, missingChecks, missingQuantity, mismatch: { ordered, received } | null }]. */
function gapsOf(items) {
  return items.map((i) => ({
    productId: i.productId, name: i.name,
    missingChecks: i.checklist.filter((c) => !i.checkedKeys.includes(c.key)).length,
    missingQuantity: i.receivedQuantity === null || i.receivedQuantity === undefined,
    mismatch: i.receivedQuantity !== null && i.receivedQuantity !== undefined && i.receivedQuantity !== i.quantity ? { ordered: i.quantity, received: i.receivedQuantity } : null,
  })).filter((g) => g.missingChecks > 0 || g.missingQuantity || g.mismatch);
}

/** May this shipment be marked inspected? { allowed } or { allowed: false, code, error, gaps }. `shipment`: the hub_shipments row. */
async function inspectCheck(db, shipment) {
  const gaps = gapsOf(await itemsOf(db, shipment.sub_order_id));
  const incomplete = gaps.filter((g) => g.missingChecks > 0 || g.missingQuantity);
  if (incomplete.length) {
    return { allowed: false, code: 'inspection_incomplete', gaps, error: `Finish the inspection list first: ${incomplete.map((g) => [g.missingChecks ? `${g.name}: ${g.missingChecks} check${g.missingChecks === 1 ? '' : 's'}` : null, g.missingQuantity ? `${g.name}: quantity received` : null].filter(Boolean).join(', ')).join('; ')}.` };
  }
  const mismatched = gaps.filter((g) => g.mismatch);
  if (mismatched.length && shipment.resolution !== 'continue_processing') {
    return { allowed: false, code: 'quantity_mismatch', gaps, error: `The quantity received does not match the order (${mismatched.map((g) => `${g.name}: ${g.mismatch.received} of ${g.mismatch.ordered}`).join('; ')}). Flag this shipment so Leap can decide.` };
  }
  return { allowed: true };
}

/** The hub ticks (or unticks) lines of one item's list. Only while the shipment is opened (being inspected). Unknown keys are dropped. */
async function saveChecks(db, { shipmentId, hubId, productId, checked }) {
  if (!Array.isArray(checked) || checked.some((k) => typeof k !== 'string')) throw new InspectionError('checked must be a list of the ticked lines (their keys)');
  const { rows } = await db.query('SELECT id, status, sub_order_id FROM hub_shipments WHERE id = $1 AND hub_id = $2', [shipmentId, hubId]);
  if (rows.length === 0) throw new InspectionError('Shipment not found', 404);
  if (rows[0].status !== 'opened') throw new InspectionError('The inspection list can be ticked only while the shipment is being inspected (opened).', 409, 'not_inspecting');
  const item = (await itemsOf(db, rows[0].sub_order_id)).find((i) => i.productId === productId);
  if (!item) throw new InspectionError('This item is not in the shipment', 404);
  const keys = new Set(item.checklist.map((c) => c.key));
  const kept = [...new Set(checked)].filter((k) => keys.has(k));
  await db.query('UPDATE order_line_items SET inspection_checks = $1::jsonb WHERE sub_order_id = $2 AND product_id = $3', [JSON.stringify(kept), rows[0].sub_order_id, productId]);
  return { productId, checkedKeys: kept };
}

/** For the hub's shipment view: an order line (with inspection_checks) and its product_attributes rows -> { checklist, checkedKeys }. */
function inspectionFields(row, attrRows) {
  const checklist = checklistFor({ part: row.part, oemNumber: row.oem_number, position: row.position, attributes: (attrRows || []).map((a) => ({ name: a.attribute_name, value: a.attribute_value })) });
  const keys = new Set(checklist.map((c) => c.key));
  return { checklist, checkedKeys: checkedOf(row.inspection_checks).filter((k) => keys.has(k)) };
}

module.exports = { CONDITION, inspectionFields, InspectionError, checklistFor, itemsOf, gapsOf, inspectCheck, saveChecks };
