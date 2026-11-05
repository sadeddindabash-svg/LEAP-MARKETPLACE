// "Get a quotation" (services/api/src/modules/quotations): the types, the calls, and how amounts and dates are shown on a quotation.
// A quotation keeps the currency and the rate of the day it was issued, so its amounts never move; they are shown with cents, like an official document.
import { apiMessage } from "./serverMessages";
import { netFetch } from "./net";
import { ARAB_WORDS } from "./currency";
import type { DictKey, Lang } from "./i18n";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export type PartyType = "insurance" | "repair_shop" | "other_party" | "employer" | "other";
export const PARTY_TYPES: readonly PartyType[] = ["insurance", "repair_shop", "other_party", "employer", "other"];
export const PARTY_KEY: Record<PartyType, DictKey> = { insurance: "party_insurance", repair_shop: "party_repair_shop", other_party: "party_other_party", employer: "party_employer", other: "party_other" };
export type QuoteState = "open" | "expired" | "ordered" | "cancelled";

export interface QuoteVehicle { make: string; model: string; year: number; vin?: string | null; plate?: string | null; makeAr?: string | null; modelAr?: string | null; version?: string | null; versionAr?: string | null }
/** The car a new quotation is for: a car of the catalogue (the server reads its make, model and version from it). */
export interface NewQuoteVehicle { generationId: string; year: number; versionId?: string | null; vin?: string | null; plate?: string | null }
export interface QuoteItem { productId: string; name: string; oemNumber: string | null; seller: string | null; quantity: number; unitPriceUsd: number; totalUsd: number; inStock: boolean; validUntil: string }
export interface QuoteShare { id: number; payer: "party" | "buyer"; percent: number; amountUsd: number; confirmed: boolean; payerName?: string | null; payerEmail?: string | null; paymentMethod?: string | null; confirmedAt?: string | null }
export interface QuoteCurrency { code: string; rate: number }
export interface Quotation {
  id: string;
  code: string;
  state: QuoteState;
  createdAt: string;
  expiresAt: string;
  party: { type: PartyType; name: string; policyNumber: string | null; reportNumber: string | null };
  vehicle: QuoteVehicle;
  /** The public view: city and country only. The buyer's view: the whole address. */
  delivery: { city?: string | null; country?: string | null; recipientName?: string; streetAddress?: string; phone?: string };
  currency: QuoteCurrency;
  items: QuoteItem[];
  subtotalUsd: number;
  shippingUsd: number;
  totalUsd: number;
  shares: QuoteShare[];
  orderId: string | null;
  openCount?: number;
  buyerName?: string | null;
  link?: string;
  qr?: string | null;
  orderPlaced?: boolean;
}
export interface QuotationSummary { id: string; code: string; state: QuoteState; createdAt: string; expiresAt: string; party: { type: PartyType; name: string }; vehicle: QuoteVehicle; itemCount: number; totalUsd: number; currency: QuoteCurrency; orderId: string | null }

export interface NewQuotation {
  items: { productId: string; quantity: number }[];
  vehicle: NewQuoteVehicle;
  partyType: PartyType;
  partyName: string;
  policyNumber?: string;
  reportNumber?: string;
  shares?: { payer: "party" | "buyer"; percent: number }[];
  addressId: string;
  lang: Lang;
  displayCurrency: string;
}

/** The server's refusal, with its code when it sent one (the page shows its own sentence for a known code). */
export class QuotationError extends Error {
  constructor(message: string, readonly code: string | null, readonly status: number) { super(message); }
}

async function call<T>(path: string, init: { method?: string; token?: string | null; body?: unknown; lang?: Lang } = {}): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await netFetch(`${API_BASE_URL}${path}${init.lang ? `${sep}lang=${init.lang}` : ""}`, {
    method: init.method ?? "GET",
    headers: { ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new QuotationError(apiMessage(data.error) || `Request failed (${res.status})`, typeof data.code === "string" ? data.code : null, res.status);
  return data as T;
}

export const createQuotation = (token: string, input: NewQuotation) => call<Quotation>("/quotations", { method: "POST", token, body: input, lang: input.lang });
export const fetchMyQuotations = (token: string) => call<QuotationSummary[]>("/quotations/me", { token });
export const fetchMyQuotation = (token: string, id: string, lang: Lang) => call<Quotation>(`/quotations/me/${encodeURIComponent(id)}`, { token, lang });
export const renewQuotation = (token: string, id: string, lang: Lang, displayCurrency: string) => call<Quotation>(`/quotations/me/${encodeURIComponent(id)}/renew`, { method: "POST", token, body: { displayCurrency }, lang });
/** `count`: false for a refresh after confirming (only a real opening of the link is counted). */
export const fetchPublicQuotation = (code: string, lang: Lang, count = true) => call<Quotation>(`/quotations/public/${encodeURIComponent(code)}${count ? "" : "?count=0"}`, { lang });
export const confirmQuotationShare = (code: string, shareId: number, payer: { name: string; email: string; phone?: string; paymentMethod: string }, lang: Lang) =>
  call<Quotation>(`/quotations/public/${encodeURIComponent(code)}/shares/${shareId}`, { method: "POST", body: payer, lang });

/** The page's own sentence for a refusal the server explained with a code. */
export const QUOTE_ERROR_KEY: Record<string, DictKey> = {
  quote_items: "err_quote_items", quote_unavailable: "err_quote_unavailable", quote_party: "err_quote_party", quote_vehicle: "err_quote_vehicle", quote_address: "err_quote_address",
  quote_share_total: "err_quote_shares", quote_share_percent: "err_quote_shares", quote_share_payer: "err_quote_shares", quote_expired: "err_quote_expired", quote_closed: "err_quote_closed",
  quote_share_done: "err_quote_share_done", quote_payer_name: "err_quote_payer_name", quote_payer_email: "err_quote_payer_email", quote_payment_method: "err_quote_payment_method",
  quote_out_of_stock: "err_quote_out_of_stock", quote_not_found: "err_quote_not_found",
};
export function quoteErrorText(e: unknown, t: (k: DictKey) => string): string {
  if (e instanceof QuotationError && e.code && QUOTE_ERROR_KEY[e.code]) return t(QUOTE_ERROR_KEY[e.code]);
  return e instanceof Error && e.message ? e.message : t("generic_error");
}

/** An amount of a quotation in its own currency, with cents: "EUR 678.18" / "2,562.00 درهم". */
export function quoteMoney(usd: number, currency: QuoteCurrency, lang: Lang): string {
  const amount = usd * (currency.rate > 0 ? currency.rate : 1);
  const digits = ["KWD", "BHD", "OMR", "JOD"].includes(currency.code) ? 3 : 2;
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
  if (lang === "ar") return `${n} ${ARAB_WORDS[currency.code] ?? currency.code}`;
  return `${currency.code} ${n}`;
}

/** "10 Nov 2026" / "10 نوفمبر 2026" (Latin digits, like the rest of the site). */
export function quoteDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export const vehicleLabel = (v: QuoteVehicle): string => [v.make, v.model, v.year, v.version].filter(Boolean).join(" ");

/** The share amounts typed as one number: the party's percent (the buyer pays the rest). */
export function sharesFor(mode: "party" | "buyer" | "split", partyPercent: number): NewQuotation["shares"] {
  if (mode === "buyer") return [{ payer: "buyer", percent: 100 }];
  if (mode === "party") return [{ payer: "party", percent: 100 }];
  const p = Math.min(99, Math.max(1, Math.round(partyPercent)));
  return [{ payer: "party", percent: p }, { payer: "buyer", percent: 100 - p }];
}
