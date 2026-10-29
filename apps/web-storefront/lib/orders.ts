// What the order pages work out from the order the server sends, with the rules of the mobile app (apps/mobile/lib/features/orders/order_detail_screen.dart and
// widgets/order_status_timeline.dart). The server enforces every one of them again; this decides what the page OFFERS.
import type { OrderDetail, OrderSummary, SupplierSubOrder } from "./api";
import { DICTIONARIES, t, type DictKey, type Lang } from "./i18n";

/** The stages a part goes through, in order, as the timeline shows them. */
export const STAGES = ["pending", "preparing", "shipped", "delivered"] as const;

/** A buyer never sees "dispute": it just means still in progress. */
export const buyerFacingStatus = (status: string): string => (status === "dispute" ? "preparing" : status);

/**
 * Where one part is, for the buyer. Before it has a hub shipment, "shipped" only means it went from the supplier to OUR hub (not to the buyer), so it is still "preparing".
 * Once the hub has it: sent on to the buyer is "shipped", received by the buyer is "delivered", anything else is still "preparing".
 */
export function subOrderStage(so: Pick<SupplierSubOrder, "status" | "hubShipment">): string {
  const raw = so.status;
  if (raw === "dispute") return "preparing";
  if (raw === "pending" || raw === "preparing") return raw;
  const hub = so.hubShipment;
  if (!hub) return raw === "shipped" ? "preparing" : raw;
  if (hub.status === "shipped_to_buyer") return "shipped";
  if (hub.status === "delivered") return "delivered";
  return "preparing";
}

/** A part can be cancelled until it has left for the buyer: not once it is on its way or delivered, and not once it went back to the supplier or was discarded at the hub. */
export function isSubOrderCancellable(so: Pick<SupplierSubOrder, "status" | "hubShipment">): boolean {
  if (so.status === "cancelled") return false;
  const hub = so.hubShipment?.status;
  if (hub === "shipped_to_buyer" || hub === "delivered") return false;
  if (hub === "returned_to_supplier" || hub === "discarded_at_hub") return false;
  return true;
}

/** The whole order can be cancelled only while EVERY part still can. */
export function isOrderCancellable(order: Pick<OrderDetail, "status" | "supplierSubOrders">): boolean {
  if (order.status === "cancelled") return false;
  return order.supplierSubOrders.every(isSubOrderCancellable);
}

/** Some parts can still be cancelled and some cannot: then each part that can be gets its own "Cancel this part" (and the whole order cannot be cancelled). */
export function isPartiallyCancellable(order: Pick<OrderDetail, "status" | "supplierSubOrders">): boolean {
  if (order.status === "cancelled") return false;
  const n = order.supplierSubOrders.filter(isSubOrderCancellable).length;
  return n > 0 && n < order.supplierSubOrders.length;
}

/**
 * The order is OVER for good: it is cancelled, or every one of its parts is (for example the only supplier refused it and nobody else could supply it). Nothing will be shipped and nothing was charged,
 * so there is nothing to check, track or give a receipt for. (An order with a part still going is not over: the other parts continue.)
 */
export function isOrderFullyCancelled(order: { status?: string; supplierSubOrders?: Array<{ status: string }> }): boolean {
  if (order.status === "cancelled") return true;
  const parts = order.supplierSubOrders ?? [];
  return parts.length > 0 && parts.every((so) => so.status === "cancelled");
}

/** The English version of the address is only a machine's guess ("auto") until the buyer confirms it: then they are asked to check it (not for an order that is over). */
export function needsEnglishAddressCheck(order: Pick<OrderDetail, "address" | "addressEnglish"> & { status?: string; supplierSubOrders?: Array<{ status: string }> }): boolean {
  return order.address != null && order.addressEnglish != null && order.addressEnglish.source === "auto" && !isOrderFullyCancelled(order);
}

/** "Request a return" is offered for a part only while it can be returned: never for a cancelled part or a cancelled order, and not once the server says the return window after delivery has passed (an older server says nothing: only the cancelled rule applies). */
export function isPartReturnable(order: { status?: string; supplierSubOrders?: Array<{ status: string }> }, part: { status: string; returnable?: boolean }): boolean {
  if (isOrderFullyCancelled(order) || part.status === "cancelled") return false;
  return part.returnable !== false;
}

/** The tracking page is offered while a part that is still going has not been delivered: never for an order that is over, and a cancelled part does not count as "not delivered yet". */
export function showTrackingLink(order: Pick<OrderDetail, "supplierSubOrders"> & { status?: string }): boolean {
  if (isOrderFullyCancelled(order)) return false;
  const going = order.supplierSubOrders.filter((so) => so.status !== "cancelled");
  return going.length > 0 && !going.every((so) => subOrderStage(so) === "delivered");
}

/** The address of the English letters the hub reads must not contain Arabic letters (the server refuses it too). */
export const hasArabicLetters = (text: string): boolean => /[\u0600-\u06FF]/.test(text);

/** The orders the "Active shipments" number counts: on their way or being got ready. */
export function activeShipmentCount(orders: Array<Pick<OrderSummary, "displayStatus" | "status">>): number {
  return orders.filter((o) => ["shipped", "to_ship", "processing"].includes(o.displayStatus || o.status)).length;
}

/** The order's lines, to put them back in the cart ("Reorder"): every item of every part, as it was ordered. */
export function reorderLines(order: Pick<OrderDetail, "supplierSubOrders">): Array<{ productId: string; quantity: number; name: string }> {
  return order.supplierSubOrders.flatMap((so) => so.items.map((i) => ({ productId: i.productId, quantity: i.quantity, name: i.name })));
}

/** Puts each line back in the cart one by one; a line that cannot be added (gone, out of stock) does not stop the rest. */
export async function reorder(lines: Array<{ productId: string; quantity: number; name: string }>, add: (productId: string, quantity: number) => Promise<void>): Promise<{ added: number; failed: string[] }> {
  let added = 0;
  const failed: string[] = [];
  for (const line of lines) {
    try { await add(line.productId, line.quantity); added++; } catch { failed.push(line.name || line.productId); }
  }
  return { added, failed };
}

/** The status as a buyer reads it, in the page's language. A status the app has no word for is shown as plain words ("in_review" gives "In Review"), never blank. */
export function statusLabel(lang: Lang, status: string): string {
  const shown = buyerFacingStatus(status);
  const key = `status_${shown.toLowerCase()}` as DictKey;
  if (key in DICTIONARIES.en) return t(lang, key);
  return shown.split("_").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

/** A date for the page (Western digits in both languages, like the rest of the site). */
export function formatDate(lang: Lang, iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en-US", { dateStyle: "medium" }).format(date);
}
