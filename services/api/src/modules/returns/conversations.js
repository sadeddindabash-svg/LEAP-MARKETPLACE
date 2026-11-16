const db = require('../../../db/pool');
const faultCases = require('../faultCases/helpers');

/**
 * Who says what on a return (migration 149, patch-returns-conversations).
 *   A return the HUB found at inspection: the hub's report opens the hub's conversation with Leap and the supplier's conversation, at the
 *   same moment, and Leap and the supplier are told. The supplier's replies reach Leap only; the hub talks with Leap in its own conversation.
 *   When the supplier accepts it, the hub is told at once to send the part back to the supplier's return address (a fault case is opened
 *   for it, as an admin would, with the supplier bearing the cost).
 *   A return the BUYER asked for: the buyer's request (reason + details) opens the supplier's conversation too. Only that first request:
 *   later buyer messages and everything Leap writes to the buyer stay between Leap and the buyer.
 *   The buyer hears only major news (a confirmed fault, approval with the instructions, the refund, rejection, completion).
 */

const DAMAGE = {
  physical_damage: { zh: '外观损坏', en: 'Physical damage' },
  water_damage: { zh: '进水/受潮', en: 'Water damage' },
  missing_parts: { zh: '缺少零件', en: 'Missing parts' },
  wrong_item: { zh: '发错商品', en: 'Wrong item' },
  other: { zh: '其他问题', en: 'Other problem' },
};

const TEXT = {
  hubReport: (hubName, damageType, notes) => {
    const d = DAMAGE[damageType] || null;
    return `${hubName} 检验时发现问题${d ? `（${d.zh}）` : ''}：${notes || '未填写备注'}\n${hubName} found a problem at inspection${d ? ` (${d.en})` : ''}: ${notes || 'no note'}`;
  },
  buyerRequest: (reason, message) => `买家的退货申请 · The buyer's return request\n原因 Reason: ${reason}\n\n${message}`,
  hubSendBack: (address) => address
    ? `供应商已同意退货。请把这件商品寄回供应商的退货地址（包裹详情中可查看并打印退货标签）。\nThe supplier accepted the return. Please send this part back to the supplier's return address (shown on the parcel, with a return label to print).`
    : `供应商已同意退货。供应商还没有填写退货地址，填写后包裹详情中会显示，请先保留这件商品。\nThe supplier accepted the return. The supplier has no return address yet: keep the part until it appears on the parcel.`,
  supplierSendBack: (address) => address
    ? '已通知质检中心把商品寄回您的退货地址。\nThe hub has been told to send the part back to your return address.'
    : '已通知质检中心准备退货，但您还没有填写退货地址：请在“设置”中填写，质检中心才能寄回。\nThe hub has been told, but you have no return address yet: please add it in Settings so the hub can send the part back.',
};

async function adminUserIds(client) {
  const { rows } = await client.query("SELECT id FROM users WHERE role = 'admin'");
  return rows.map((r) => r.id);
}
async function supplierUserIdsOfSubOrder(client, subOrderId) {
  const { rows } = await client.query("SELECT u.id FROM users u JOIN supplier_sub_orders so ON so.supplier_id = u.supplier_id WHERE so.id = $1 AND u.role = 'supplier'", [subOrderId]);
  return rows.map((r) => r.id);
}

/** The hub flagged a parcel (inside the hub's transaction): its report opens both conversations. Returns the notifications to send after the commit. */
async function onHubFlag(client, { caseId, shipment, notes, damageType, userId }) {
  const { rows: [hub] } = await client.query('SELECT name FROM hubs WHERE id = $1', [shipment.hub_id]);
  const { rows: [so] } = await client.query('SELECT order_id FROM supplier_sub_orders WHERE id = $1', [shipment.sub_order_id]);
  const hubName = hub ? hub.name : 'The hub';
  const text = TEXT.hubReport(hubName, damageType, notes);
  await client.query("INSERT INTO return_case_hub_messages (case_id, sender_role, sender_id, message) VALUES ($1, 'hub', $2, $3)", [caseId, userId || null, text]);
  await client.query("INSERT INTO return_case_supplier_messages (case_id, sender_role, message) VALUES ($1, 'hub', $2)", [caseId, text]);
  await client.query('UPDATE return_cases SET hub_read_at = now() WHERE id = $1', [caseId]);
  const out = [];
  for (const id of await supplierUserIdsOfSubOrder(client, shipment.sub_order_id)) {
    out.push({ userId: id, type: 'return_status', title: `质检中心发现问题 · The hub found a problem (${caseId})`, body: `订单 ${so.order_id}：${notes || ''}\nOrder ${so.order_id}: please check the hub's photos on the Returns page and answer.`, linkType: 'return_case', linkId: caseId });
  }
  for (const id of await adminUserIds(client)) {
    out.push({ userId: id, type: 'supplier_message', title: `Return ${caseId}: the hub found a problem`, body: `${hubName}, order ${so.order_id}: ${notes || 'no note'}`, linkType: 'order', linkId: so.order_id });
  }
  return out;
}

/** The buyer filed a return (inside its transaction): the request opens the supplier's conversation. */
async function copyBuyerRequest(client, { caseId, reason, message }) {
  await client.query("INSERT INTO return_case_supplier_messages (case_id, sender_role, message) VALUES ($1, 'buyer', $2)", [caseId, TEXT.buyerRequest(reason, message)]);
}

/**
 * The supplier accepted a return the hub found: tell the hub to send the part back to the supplier's return address. Opens the fault case
 * (all the parcel's items, the supplier bears the cost) that the hub's "return to supplier" step needs. Never throws; returns whether it did.
 */
async function sendBackAfterSupplierAccepts(caseId) {
  const client = await db.getPool().connect();
  let notifications = [];
  try {
    await client.query('BEGIN');
    const { rows: [rc] } = await client.query('SELECT * FROM return_cases WHERE id = $1 FOR UPDATE', [caseId]);
    if (!rc || rc.source !== 'hub') { await client.query('ROLLBACK'); return { done: false }; }
    const { rows: [shipment] } = await client.query("SELECT * FROM hub_shipments WHERE sub_order_id = $1 AND status = 'flagged' AND resolved_at IS NULL", [rc.sub_order_id]);
    if (!shipment) { await client.query('ROLLBACK'); return { done: false }; }
    const { rows: existing } = await client.query('SELECT 1 FROM fault_cases WHERE shipment_id = $1', [shipment.id]);
    if (existing.length > 0) { await client.query('ROLLBACK'); return { done: false, already: true }; }
    const { rows: lines } = await client.query('SELECT product_id FROM order_line_items WHERE sub_order_id = $1', [rc.sub_order_id]);
    const made = await faultCases.createFaultCase(client, {
      shipmentId: shipment.id, items: lines.map((l) => l.product_id), costBearer: 'supplier', adminId: null,
      notes: 'Opened automatically: the supplier accepted the return after seeing the hub\'s report (patch-returns-conversations).',
    });
    notifications = made.notifications;
    const { rows: [so] } = await client.query('SELECT supplier_id FROM supplier_sub_orders WHERE id = $1', [rc.sub_order_id]);
    const { getReturnAddress } = require('../supplierReturnAddress/helpers');
    const address = await getReturnAddress(so.supplier_id, client);
    await client.query("INSERT INTO return_case_hub_messages (case_id, sender_role, message) VALUES ($1, 'admin', $2)", [caseId, TEXT.hubSendBack(address)]);
    await client.query("INSERT INTO return_case_supplier_messages (case_id, sender_role, message) VALUES ($1, 'admin', $2)", [caseId, TEXT.supplierSendBack(address)]);
    await client.query('COMMIT');
    await faultCases.sendNotifications(notifications);
    return { done: true, hasReturnAddress: Boolean(address) };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[returns] sending the part back after the supplier accepted failed (non-fatal):', err.message);
    return { done: false, error: err.message };
  } finally {
    client.release();
  }
}

module.exports = { DAMAGE, TEXT, onHubFlag, copyBuyerRequest, sendBackAfterSupplierAccepts, adminUserIds };
