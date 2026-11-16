import { API_BASE_URL, getStoredToken } from "./auth";

/**
 * The numbers in the side menu and on the tabs of its groups (GET /admin-counts): orders not delivered, suppliers waiting for approval, unread
 * supplier messages, open returns, open flagged shipments, open tickets, shipping costs waiting for approval. Quiet: a failed load keeps what is shown.
 */
export async function fetchAdminCounts(token = getStoredToken()) {
  const res = await fetch(`${API_BASE_URL}/admin-counts`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`admin counts: ${res.status}`);
  return res.json();
}

const RED = new Set(["flagged", "shippingCosts"]);      // these hold something up: shown in red

/** The number (and its hover text) for one page. `flaggedCount`: the count the shell already had, used until /admin-counts answers. */
export function pageBadge(counts, pageId, { flaggedCount = 0 } = {}) {
  const c = counts || {};
  let n = 0; let tip = "";
  if (pageId === "orders" && c.orders) {
    n = c.orders.notDelivered; tip = `${n} ${n === 1 ? "order" : "orders"} not delivered yet${c.orders.late ? ` · ${c.orders.late} late` : ""}`;
  } else if (pageId === "suppliers") { n = c.suppliers || 0; tip = `${n} ${n === 1 ? "supplier" : "suppliers"} waiting for approval`; }
  else if (pageId === "supplierMessages") { n = c.supplierMessages || 0; tip = `${n} unread ${n === 1 ? "message" : "messages"} from suppliers`; }
  else if (pageId === "returns") { n = c.returns || 0; tip = `${n} open ${n === 1 ? "return" : "returns"}`; }
  else if (pageId === "flagged") { n = c.flagged ?? flaggedCount; tip = `${n} flagged ${n === 1 ? "shipment" : "shipments"} still open`; }
  else if (pageId === "tickets") { n = c.tickets || 0; tip = `${n} open ${n === 1 ? "ticket" : "tickets"}`; }
  else if (pageId === "shippingCosts") { n = c.shippingCosts || 0; tip = `${n} ${n === 1 ? "parcel's" : "parcels'"} shipping cost waiting for your approval`; }
  return n > 0 ? { count: n, red: RED.has(pageId), tip } : { count: 0, red: false, tip: "" };
}

/** A side-menu entry: one page, or a group (the total of its pages this admin may open). */
export function menuBadge(counts, pageIds, extra) {
  const parts = pageIds.map((id) => pageBadge(counts, id, extra)).filter((b) => b.count > 0);
  return { count: parts.reduce((s, b) => s + b.count, 0), red: parts.some((b) => b.red), tip: parts.map((b) => b.tip).join(" · ") };
}

/** For a tab inside a group: { count, tone } as the page tabs take them (nothing when 0). */
export function tabBadge(counts, pageId, extra) {
  const b = pageBadge(counts, pageId, extra);
  return b.count > 0 ? { count: b.count, tone: b.red ? "red" : "ink", tip: b.tip } : {};
}
