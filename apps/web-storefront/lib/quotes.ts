// A quote request ("My requests"), with the rules of the mobile app (apps/mobile/lib/features/quote_requests): a buyer lists up to 20 parts for a car, the Leap team makes each
// part and prices it, and the buyer puts the ready ones in the cart. The server enforces every rule again.
import type { QuoteRequest } from "./api";
import type { DictKey } from "./i18n";

export const MAX_QUOTE_ITEMS = 20;

/** The status as the buyer sees it. A quote is valid for 7 days: once its date has passed it reads "expired" (the server refuses to order from it too). */
export function displayStatus(r: Pick<QuoteRequest, "status" | "expiresAt">, now: number = Date.now()): string {
  if (r.status === "quoted" && r.expiresAt && new Date(r.expiresAt).getTime() < now) return "expired";
  return r.status;
}

/** A request can be cancelled until it has been quoted. */
export const canCancel = (r: Pick<QuoteRequest, "status">): boolean => r.status === "draft" || r.status === "submitted";
/** Only a draft can still be added to and sent. */
export const canAddItems = (r: Pick<QuoteRequest, "status">): boolean => r.status === "draft";
/** Once quoted (and while the quote is valid) the buyer may change quantities and remove parts. */
export const canAdjustQuote = (r: Pick<QuoteRequest, "status" | "expiresAt">, now?: number): boolean => displayStatus(r, now) === "quoted";

/** The parts that can be bought now: priced, and the made product has been approved. */
export const readyItems = (r: Pick<QuoteRequest, "items">) => r.items.filter((i) => i.readyToOrder);
export const quoteTotal = (r: Pick<QuoteRequest, "items">): number => readyItems(r).reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);
/** "Add to cart" is offered when the quote is valid and at least one part is ready. */
export const canOrder = (r: Pick<QuoteRequest, "status" | "expiresAt" | "items">, now?: number): boolean => displayStatus(r, now) === "quoted" && readyItems(r).length > 0;

const STATUS_KEYS: Record<string, DictKey> = { draft: "qstatus_draft", submitted: "qstatus_submitted", quoted: "qstatus_quoted", ordered: "qstatus_ordered", expired: "qstatus_expired", cancelled: "qstatus_cancelled" };
/** The word for a status, or null for one the app has no word for (the page then shows it as plain words). */
export const statusKey = (status: string): DictKey | null => STATUS_KEYS[status] ?? null;

const BANNER_KEYS: Record<string, DictKey> = { draft: "request_draft_note", submitted: "awaiting_quote", quoted: "quote_received", ordered: "request_ordered", expired: "quote_expired", cancelled: "request_cancelled" };
export const bannerKey = (status: string): DictKey | null => BANNER_KEYS[status] ?? null;

/** The pill colours: quoted green, ordered blue, submitted amber, anything else grey (the app's). */
export function statusColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case "quoted": return { bg: "#e3f2ea", fg: "#0f6b49" };
    case "ordered": return { bg: "#e3edf7", fg: "#1d5fb0" };
    case "submitted": return { bg: "#fdf1d6", fg: "#7a4e00" };
    default: return { bg: "#eef2f5", fg: "#53636f" };
  }
}
