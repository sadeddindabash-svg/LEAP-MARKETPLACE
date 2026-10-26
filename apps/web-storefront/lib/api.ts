/**
 * Real API client for the web storefront -- reads from the SAME real
 * backend (services/api) already serving the mobile app and every
 * other portal in this project. Deliberately plain, typed fetch
 * helpers (no client-side state library needed) since every call here
 * runs on the server, inside a real React Server Component, which is
 * the whole point of this app existing: real, crawlable HTML on first
 * load, not a client-rendered shell search engines can't read.
 *
 * Every field below was verified directly against
 * services/api/src/modules/catalog/routes.js's own real DTO-building
 * functions (toBuyerProductDto, attachBuyerImages, attachBuyerPrice,
 * attachPrimaryFitment, toCategoryDto) rather than assumed.
 */

import type { Lang } from "./i18n";
import type { HomeText } from "./homeText";
import type { FooterContent, LegalPageDto, PageKey } from "./footerContent";
import { apiMessage } from "./serverMessages";
import { NetworkError, netFetch } from "./net";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export interface ProductSummary {
  id: string;
  name: string;
  description: string | null;
  category: string;
  part: string;
  position: string | null;
  oemNumber: string | null;
  currencyCode: string;
  rating: number | null;
  reviewCount: number;
  stockQuantity: number;
  estimatedDeliveryDays: number | null;
  weightKg: number | null;
  /** The size (cm) the shipping is worked out from, and whether it is only the part's typical size (shown as approximate). */
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  sizeApprox?: boolean;
  status: string;
  price: number;
  images: string[];
  /** The vehicle brand the part is for (the "More BYD parts" section is named by it). */
  brand?: string | null;
  /** Sent by the server for every product; shown in compare. */
  isVerifiedSeller?: boolean;
  shipsFromCountry?: string | null;
  shipsFromCountryAr?: string | null;
  /** Sent when a discount applies: the price before the discount (the price above is the one to pay). */
  originalPrice?: number | null;
}

export interface ProductDetail extends ProductSummary {
  brand: string | null;
  model: string | null;
  year: number | null;
  fitsVehicleIds: string[];
  /** The first cars the product fits, how many in all, and a "generation|year" key for each one (the "fits your car?" message). */
  fitCars?: { generationId: string; year: number | null; brand: string | null; brandAr?: string | null; model: string | null; modelAr?: string | null }[];
  fitCarCount?: number;
  fitKeys?: string[];
  /** The part's own attributes (material, colour...), as entered for this product. */
  attributes?: Array<{ name: string; value: string }>;
}

export interface ProductCategory {
  id: string;
  nameEn: string;
  nameAr: string;
  // Real category photo (new) -- the backend has supported this since
  // migration 046 (categories now require a real photo on creation),
  // but nothing on this storefront ever fetched or displayed it.
  photoUrl: string | null;
  sortOrder: number;
  commissionPercent: number;
}

export interface ReviewsSummary {
  averageRating: number | null;
  reviewCount: number;
  reviews: Array<{
    id: number;
    buyerName: string | null;
    rating: number;
    comment: string | null;
    createdAt: string;
    photos: string[];
    isVerifiedPurchase: boolean;
  }>;
}

// Real, server-side revalidation window -- product data doesn't need
// to be refetched on every single real request (that would put real,
// needless load on the backend for a storefront that's mostly read
// traffic), but it also shouldn't go stale for long. 60 real seconds
// balances both; tune this once real traffic patterns are known.
const REVALIDATE_SECONDS = 60;

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await netFetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Real, honest fallback -- a real backend hiccup should show an
    // empty/graceful state on the page, never crash server rendering
    // entirely for every visitor.
    return null;
  }
}

export async function fetchCategories(): Promise<ProductCategory[]> {
  const data = await apiGet<ProductCategory[]>("/catalog/categories");
  return data ?? [];
}

export async function fetchProducts(params: {
  category?: string;
  search?: string;
  sort?: string;
  // Real vehicle-fitment filter (new) -- the same generationId/year
  // filter the mobile app's own search vehicle picker already uses
  // (see services/api/README.md's "Brand/Model/Generation(Year) filter
  // for search" section), against the real, structured
  // Brand->Model->Generation cascade every real product's fitment is
  // actually stored in -- not the flat, unpopulated-for-matching
  // reference table this storefront's own My Garage equivalent would
  // otherwise risk repeating (see apps/mobile/README.md's "My Garage"
  // section for that exact real bug, already fixed there).
  generationId?: string;
  year?: number;
  /** A part of the category, by its English name ("Front Brake Disc"): the server filters by it. */
  part?: string;
  /** "ar" asks the server for Arabic product names and descriptions. */
  lang?: Lang;
} = {}): Promise<ProductSummary[]> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.part) query.set("part", params.part);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  if (params.generationId) query.set("generationId", params.generationId);
  if (params.year) query.set("year", String(params.year));
  if (params.lang === "ar") query.set("lang", "ar");
  const qs = query.toString();
  const data = await apiGet<ProductSummary[]>(`/catalog/products${qs ? `?${qs}` : ""}`);
  return data ?? [];
}

// Real pagination (new) -- a separate function from fetchProducts
// above, deliberately: that one keeps returning a bare array for every
// existing caller (home page, wishlist, etc.), completely unaffected.
// This one is for /search specifically, which needs the real total
// count too (to build real page-number controls) -- exposed by the
// backend via a real X-Total-Count response header rather than a
// different body shape (see services/api/README.md's own note on
// this), so this needs its own real fetch to read response headers,
// which apiGet's shared helper above doesn't expose.
export async function fetchProductsPaginated(params: {
  category?: string;
  search?: string;
  sort?: string;
  generationId?: string;
  year?: number;
  page?: number;
  limit?: number;
  lang?: Lang;
  part?: string;
  /** This CONTINUES a list the buyer is already scrolling through (lazy loading): the server may answer from its short-lived cache of the computed list and does not count it as a new search. */
  more?: boolean;
} = {}): Promise<{ items: ProductSummary[]; total: number; unreachable?: boolean }> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.part) query.set("part", params.part);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  if (params.generationId) query.set("generationId", params.generationId);
  if (params.year) query.set("year", String(params.year));
  if (params.lang === "ar") query.set("lang", "ar");
  if (params.more) query.set("more", "1");
  query.set("page", String(params.page || 1));
  query.set("limit", String(params.limit || 24));
  let res: Response;
  try {
    res = await netFetch(`${API_BASE_URL}/catalog/products?${query.toString()}`, { next: { revalidate: REVALIDATE_SECONDS } });
  } catch (e) {
    if (e instanceof NetworkError) return { items: [], total: 0, unreachable: true };
    throw e;
  }
  if (!res.ok) return { items: [], total: 0 };
  const items = (await res.json()) as ProductSummary[];
  const total = Number(res.headers.get("X-Total-Count") || items.length);
  return { items, total };
}

/** The footer as the admin set it (texts, social media icons, which pages have text), or null when the shop cannot be reached (the website then uses its own footer). */
export async function fetchFooterContent(): Promise<FooterContent | null> {
  try {
    return await apiGet<FooterContent>("/platform-settings/footer");
  } catch {
    return null;
  }
}
/** One of the six pages (its title and text, in both languages), or null when it cannot be read. */
export async function fetchLegalPage(key: PageKey): Promise<LegalPageDto | null> {
  try {
    return await apiGet<LegalPageDto>(`/platform-settings/footer/pages/${key}`);
  } catch {
    return null;
  }
}

/** The texts the admin set for the home page (top bar, headline, sub-headline), or null when the shop cannot be reached (the website then uses its own wording). */
export async function fetchHomeText(): Promise<HomeText | null> {
  try {
    const data = await apiGet<{ text: HomeText }>("/platform-settings/home-text");
    return data?.text ?? null;
  } catch {
    return null;            // the shop cannot be reached: the website uses its own wording
  }
}

/** The pictures the admin chose for the four home page tiles (an address, or null: the tile then shows its icon). */
export interface HomePictures { parts: string | null; brands: string | null; models: string | null; countries: string | null }
export async function fetchHomePictures(): Promise<HomePictures | null> {
  const data = await apiGet<{ pictures: HomePictures }>("/platform-settings/home-pictures");
  return data?.pictures ?? null;
}

/** The four real totals of the home page (counted by the server). */
export interface SiteStats { parts: number; brands: number; models: number; countries: number }
export async function fetchSiteStats(): Promise<SiteStats | null> {
  return apiGet<SiteStats>("/catalog/stats");
}

export async function fetchProductById(id: string, lang?: Lang): Promise<ProductDetail | null> {
  return apiGet<ProductDetail>(`/catalog/products/${id}${lang === "ar" ? "?lang=ar" : ""}`);
}

export async function fetchProductReviews(id: string): Promise<ReviewsSummary> {
  const data = await apiGet<ReviewsSummary>(`/catalog/products/${id}/reviews`);
  return data ?? { averageRating: null, reviewCount: 0, reviews: [] };
}

// Real image URLs come back two real ways from the backend (see
// services/api/src/modules/uploads/routes.js): a real, relative path
// like "/uploads/xyz.jpg" for local dev storage, or a real, already-
// absolute URL for real cloud storage (S3-compatible). Prefixing an
// already-absolute URL with the API base would break it, so this
// checks first rather than assuming one shape.
export function resolveImageUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}


// ---------------- Real cart (client-side calls) ----------------
// Unlike everything above, these run in the BROWSER (called from
// Client Components), not on the server -- the cart is a real,
// per-visitor, interactive concern with no SEO value, so it's the one
// part of this app that doesn't need server rendering. Talks directly
// to the SAME real backend cart module the mobile app already uses
// (services/api/src/modules/cart/routes.js) -- a client-generated
// cart ID, no separate "create cart" call needed.

export interface CartItem {
  productId: string;
  quantity: number;
  name: string;
  price: number;
  /** The price before a reduction, when the part is on sale (shown struck through). */
  originalPrice?: number | null;
  /** The live price moved since the buyer's prices were locked. */
  priceChanged?: boolean;
  currencyCode: string;
  imageUrl?: string | null;
  supplierName: string | null;
  weightKg?: number | null;
  // Live stock quantity: an early warning, not a reservation (see services/api/src/modules/cart/routes.js).
  stockQuantity: number;
}

export interface Cart {
  cartId: string;
  items: CartItem[];
  /** The promo code on the cart, and what it is (null when none, or when it stopped being valid). */
  appliedPromoCode?: string | null;
  appliedPromoDetails?: { code: string; type: string; value: number | null } | null;
  promoDiscountUsd?: number;
  /** The buyer's loyalty discount (only for a signed-in buyer, and only when the cart request carries their token). */
  loyaltyDiscountPercentage?: number;
  loyaltyDiscountUsd?: number;
  /** The server applies ONE discount, the bigger of loyalty and promo. */
  appliedDiscountSource?: "loyalty" | "promo" | "none";
  appliedDiscountUsd?: number;
  /** Prices are locked while the buyer checks out, so they cannot change under them. */
  lockActive?: boolean;
  lockExpiresAt?: string | null;
}

/** Who is asking and in which language: a signed-in buyer's token (so the server can apply THEIR loyalty discount and promo rules) and the page's language (Arabic names). */
export interface CartCallOptions { token?: string | null; lang?: Lang }

async function cartApiCall<T>(path: string, options?: RequestInit, who: CartCallOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}/cart${path}${who.lang === "ar" ? `${path.includes("?") ? "&" : "?"}lang=ar` : ""}`;
  const res = await netFetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(who.token ? { Authorization: `Bearer ${who.token}` } : {}), ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Cart request failed (${res.status})`));
  }
  return res.json() as Promise<T>;
}

export const fetchCart = (cartId: string, who?: CartCallOptions) => cartApiCall<Cart>(`/${cartId}`, undefined, who);
export const addCartItem = (cartId: string, productId: string, quantity: number, who?: CartCallOptions) => cartApiCall<Cart>(`/${cartId}/items`, { method: "POST", body: JSON.stringify({ productId, quantity }) }, who);
export const setCartItemQuantity = (cartId: string, productId: string, quantity: number, who?: CartCallOptions) => cartApiCall<Cart>(`/${cartId}/items/${productId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }, who);
export const removeCartItem = (cartId: string, productId: string, who?: CartCallOptions) => cartApiCall<Cart>(`/${cartId}/items/${productId}`, { method: "DELETE" }, who);
/** Freezes the prices for the checkout (the app does this the moment the checkout opens). A lock already running is left as it is. */
export const lockCartPrices = (cartId: string, who?: CartCallOptions) => cartApiCall<Cart>(`/${cartId}/lock-prices`, { method: "POST" }, who);
/** Puts a promo code on the cart (the server checks it; an invalid one is refused with the reason), or removes it with null. */
export const applyCartPromoCode = (cartId: string, code: string | null, who?: CartCallOptions) => cartApiCall<Cart>(`/${cartId}/promo-code`, { method: "PATCH", body: JSON.stringify({ code }) }, who);

// Real guest checkout -- POST /order with guestEmail + address (both
// optional for a real guest per migration 030, but the storefront's
// own confirmed Phase 1 scope always collects a real address upfront
// at checkout, rather than the mobile app's post-order geolocation
// flow, which doesn't make sense for a desktop browser).
export interface PlaceOrderAddress {
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  streetAddress: string;
}

export interface PlaceOrderResult {
  id: string;
  total: number;
  currencyCode: string;
}

// REAL BUG FOUND AND FIXED HERE: this used to always send guestEmail,
// even for a real logged-in buyer (checked via useAuth() in
// app/checkout/page.tsx) -- every single order placed through this
// storefront's checkout became a guest order, buyer_id null, with zero
// connection to the real account that was actually logged in. The
// real backend (POST /order) already accepted userId + addressId (a
// saved address) the whole time; this client function just never used
// either. Renamed from placeGuestOrder to placeOrder to match its real,
// dual (guest OR logged-in) purpose -- the only real caller
// (app/checkout/page.tsx) is updated in the same pass.
export interface PlaceOrderOptions {
  /** The cart has parts from several suppliers: true waits and ships everything in ONE delivery (the app's "Wait and ship together"). */
  waitForAllShipments?: boolean;
  /** The same key sent twice returns the FIRST order, so a double click or a retry never places the order twice. */
  idempotencyKey?: string;
  lang?: Lang;
}

export async function placeOrder(
  items: Array<{ productId: string; quantity: number }>,
  auth: { userId?: string; guestEmail?: string },
  addressInput: { addressId: string } | { address: PlaceOrderAddress },
  promoCode?: string,
  options: PlaceOrderOptions = {}
): Promise<PlaceOrderResult> {
  const res = await netFetch(`${API_BASE_URL}/order${options.lang === "ar" ? "?lang=ar" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items, ...auth, ...addressInput,
      ...(promoCode ? { promoCode } : {}),
      ...(options.waitForAllShipments !== undefined ? { waitForAllShipments: options.waitForAllShipments } : {}),
      ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(apiMessage(body.error) || apiMessage(`Failed to place order (${res.status})`));
  return body as PlaceOrderResult;
}

/** A way to pay that is available in a country (set up by the admin). In the app and here it is a CHOICE shown at checkout: no payment is collected online yet. */
export interface PaymentMethod { id: string; nameEn: string; nameAr: string; photoUrl: string | null }

/** The payment methods active for a country (its English name or its code). An unknown country simply has none. */
export async function fetchPaymentMethodsForCountry(country: string): Promise<PaymentMethod[]> {
  const data = await apiGet<PaymentMethod[]>(`/payment-methods/for-country/${encodeURIComponent(country)}`);
  return data ?? [];
}

// Real, immediate promo-code validation (new) -- calls the backend's
// own real POST /promo-codes/validate (optionalAuth -- works for a
// guest too), giving a buyer immediate feedback on whether a code is
// real and currently usable, WITHOUT computing or trusting any
// discount amount client-side. The actual, authoritative discount only
// ever comes from the real order-placement response itself
// (placeOrder's own real `total`) -- this is deliberately just a
// "is this code even real right now" check, not a discount preview,
// since replicating the backend's own discount math (which handles
// shipping-portion logic for free_shipping-type codes) client-side
// would risk it silently drifting out of sync with the real backend
// logic over time.
export async function validatePromoCode(code: string, token?: string): Promise<{ valid: true } | { valid: false; reason: string }> {
  const res = await netFetch(`${API_BASE_URL}/promo-codes/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ code }),
  });
  const body = await res.json();
  if (!res.ok) return { valid: false, reason: body.reason || body.error || "This code isn't valid." };
  return { valid: true };
}

// ---------------- Real buyer address book (client-side calls, new) ----------------
// Reuses the SAME real GET/POST/DELETE /addresses/me* endpoints the
// mobile app already uses (migration 017) -- a real logged-in buyer
// can save up to 3 addresses, enforced by the backend itself, not
// re-checked here.

export interface SavedAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  country: string;
  state?: string | null;
  city: string;
  streetAddress: string;
  postalCode: string | null;
  nationalAddress?: string | null;
  isDefault: boolean;
  createdAt: string;
}

export async function fetchMyAddresses(token: string): Promise<SavedAddress[]> {
  const res = await netFetch(`${API_BASE_URL}/addresses/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to load addresses (${res.status})`));
  }
  return res.json();
}

/** What the server takes for a saved address (see lib/address.ts addressPayload). */
export interface AddressPayload { label: string; recipientName: string; phone: string; country: string; state?: string | null; city: string; streetAddress: string; postalCode?: string | null; nationalAddress?: string; isDefault?: boolean }

export const createAddress = (token: string, address: AddressPayload) => authedJson<SavedAddress>(token, "/addresses/me", "POST", "Failed to save address", address);
export const updateAddress = (token: string, id: string, updates: Partial<AddressPayload>) => authedJson<SavedAddress>(token, `/addresses/me/${encodeURIComponent(id)}`, "PATCH", "Failed to update address", updates);
export const deleteAddress = (token: string, id: string) => authedJson<void>(token, `/addresses/me/${encodeURIComponent(id)}`, "DELETE", "Failed to delete address");

// ---------------- Real saved searches (client-side calls) ----------------
// Same reasoning as the cart section above -- these run in the
// browser (Client Components), require a real logged-in account, and
// have no SEO value.

export interface SavedSearch {
  id: number;
  label: string;
  searchTerm: string | null;
  category: string | null;
  createdAt: string;
  lastCheckedAt: string | null;
}

async function savedSearchApiCall<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await netFetch(`${API_BASE_URL}/saved-searches${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiMessage(body.error) || apiMessage(`Saved search request failed (${res.status})`));
  return body as T;
}

export function fetchSavedSearches(token: string): Promise<SavedSearch[]> {
  return savedSearchApiCall<SavedSearch[]>("/me", token);
}

export function createSavedSearch(
  token: string,
  params: { searchTerm?: string; category?: string; label: string }
): Promise<SavedSearch> {
  return savedSearchApiCall<SavedSearch>("/me", token, { method: "POST", body: JSON.stringify(params) });
}

export async function deleteSavedSearch(token: string, id: number): Promise<void> {
  const res = await netFetch(`${API_BASE_URL}/saved-searches/me/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to delete saved search (${res.status})`));
  }
}

// ---------------- Real order history + detail (client-side calls, new) ----------------
// Same reasoning as saved searches above -- real logged-in account,
// no SEO value, browser-only. Closes the single biggest gap this
// storefront had: a buyer who checked out here previously had no way
// to ever see a past order again. Same real GET /order and
// GET /order/:id endpoints the mobile app already uses -- verified
// directly against services/api/src/modules/order/routes.js's own DTO
// shape rather than assumed.

export interface OrderSummary {
  id: string;
  status: string;
  displayStatus: string;
  total: number;
  currencyCode: string;
  placedAt: string;
  guestEmail?: string | null;
  /** The anonymised supplier labels ("Supplier LEAP-SLR-AB12"). */
  supplierNames?: string[];
}

export interface HubShipmentEvent {
  step: string;
  notes: string | null;
  trackingNumber: string | null;
  performedBy: string | null;
  createdAt: string;
  photos: string[];
}

/** The photos the courier took when the parcel was delivered: the buyer's own evidence that it arrived. */
export interface DeliveryProof { photos: Array<{ url: string; submittedAt: string }> }

export interface HubShipment {
  id: number;
  status: string;
  updatedAt: string;
  events: HubShipmentEvent[];
  deliveryProof?: DeliveryProof | null;
}

export interface OrderLineItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string | null;
}

export interface SupplierSubOrder {
  subOrderId: number;
  supplierId: string;
  supplierName: string | null;
  status: string;
  trackingNumber: string | null;
  hubId: string | null;
  hubName: string | null;
  hubShipment: HubShipment | null;
  items: OrderLineItem[];
}

export interface OrderAddress {
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  streetAddress: string;
  postalCode: string | null;
  source: string;
}

/** The delivery address in English letters, for the inspection hub. `source` "auto" is a machine's guess nobody has confirmed yet. */
export interface EnglishAddress {
  recipientName: string; country: string; city: string; streetAddress: string; state: string | null;
  source: "same" | "auto" | "buyer" | "admin" | string; confirmed: boolean; updatedAt: string | null;
}

export interface OrderDetail {
  id: string;
  isReplacement?: boolean;
  userId: string | null;
  guestEmail: string | null;
  isGuestOrder: boolean;
  status: string;
  displayStatus: string;
  total: number;
  discountAmount: number;
  promoCode: string | null;
  currencyCode: string;
  waitForAllShipments?: boolean;
  placedAt: string;
  address: OrderAddress | null;
  addressEnglish?: EnglishAddress | null;
  supplierSubOrders: SupplierSubOrder[];
}

export async function fetchMyOrders(token: string): Promise<OrderSummary[]> {
  const res = await netFetch(`${API_BASE_URL}/order`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to load orders (${res.status})`));
  }
  return res.json();
}

/** Who is asking about an order: a signed-in buyer (token) or a guest (the email the order was placed with). */
export interface OrderWho { token?: string | null; guestEmail?: string | null }

async function orderCall<T>(path: string, who: OrderWho, init: { method?: string; body?: Record<string, unknown>; query?: Record<string, string> } = {}, failure = "Request failed"): Promise<T> {
  const query = new URLSearchParams(init.query ?? {});
  const method = init.method ?? "GET";
  // A guest is identified by the email the order was placed with: in the query of a read, in the body of a change (that is where the server looks for it).
  const guest = !who.token && who.guestEmail ? { guestEmail: who.guestEmail } : {};
  if (method === "GET" && "guestEmail" in guest) query.set("guestEmail", guest.guestEmail as string);
  const body = method === "GET" ? undefined : { ...(init.body ?? {}), ...guest };
  const qs = query.toString();
  const res = await netFetch(`${API_BASE_URL}/order${path}${qs ? `?${qs}` : ""}`, {
    method,
    headers: { ...(who.token ? { Authorization: `Bearer ${who.token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiMessage(data.error) || apiMessage(`${failure} (${res.status})`));
  return data as T;
}

export const fetchOrderById = (token: string | null, orderId: string, guestEmail?: string | null) =>
  orderCall<OrderDetail>(`/${encodeURIComponent(orderId)}`, { token, guestEmail }, {}, "Failed to load order");

// ---------------- Real wishlist (client-side calls, new) ----------------
// Same reasoning as saved searches/orders above -- real logged-in
// account, browser-only. Reuses ProductSummary since the backend's
// GET /wishlist/me genuinely returns the same product DTO shape as
// GET /catalog/products (see services/api/src/modules/wishlist/routes.js,
// which reuses the catalog module's own DTO-building helpers directly
// rather than a separate wishlist-specific shape).

export async function fetchWishlist(token: string): Promise<ProductSummary[]> {
  const res = await netFetch(`${API_BASE_URL}/wishlist/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to load wishlist (${res.status})`));
  }
  return res.json();
}

export async function checkWishlisted(token: string, productId: string): Promise<boolean> {
  const res = await netFetch(`${API_BASE_URL}/wishlist/me/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const body = await res.json();
  return body.wishlisted;
}

export async function addToWishlist(token: string, productId: string): Promise<void> {
  const res = await netFetch(`${API_BASE_URL}/wishlist/me/${productId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to add to wishlist (${res.status})`));
  }
}

export async function removeFromWishlist(token: string, productId: string): Promise<void> {
  const res = await netFetch(`${API_BASE_URL}/wishlist/me/${productId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to remove from wishlist (${res.status})`));
  }
}

// ---------------- Real review submission (client-side calls, new) ----------------
// Reading reviews (fetchProductReviews above) already existed and is
// server-rendered for real SEO value. WRITING one is the missing
// half -- real logged-in account, no SEO value in the act of
// submitting, so this is a browser-only Client Component concern,
// same reasoning as cart/wishlist/orders above.

export interface SubmittedReview {
  id: number;
  productId: string;
  rating: number;
  comment: string | null;
  status: string;
  isVerifiedPurchase: boolean;
  photos: string[];
}

/** An error from the server that keeps its machine-readable `code` (when it sends one), so the page can word the problem in the buyer's language. */
export class ApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) { super(message); this.name = "ApiError"; }
}

export async function submitReview(
  token: string,
  params: { productId: string; rating: number; comment?: string; photos?: string[] }
): Promise<SubmittedReview> {
  const res = await netFetch(`${API_BASE_URL}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || `Failed to submit review (${res.status})`, body.code, res.status);
  return body;
}

// Real photo upload for a review, reusing the SAME generic backend
// endpoint the mobile app's review photos and every other real photo
// upload in this project already use (services/api/src/modules/
// uploads/routes.js) -- validates real dimensions/type there, not
// re-implemented here. Plain File here (not XFile like mobile), since
// this runs against a real <input type="file"> in a browser.
export async function uploadReviewPhoto(token: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await netFetch(`${API_BASE_URL}/uploads/product-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiMessage(body.error) || apiMessage(`Failed to upload photo (${res.status})`));
  return body.url;
}

// ---------------- Real referrals (client-side calls, new) ----------------
// Same reasoning as orders/wishlist/saved-searches above -- real
// logged-in account, browser-only. Reuses the SAME GET /referrals/me
// endpoint the mobile app already uses (see
// services/api/src/modules/referrals/routes.js) -- a buyer's own code
// is created on first request if they don't have one yet.

export interface ReferralInfo {
  code: string;
  totalReferred: number;
  rewardsEarned: number;
  maxRewards: number;
  capReached: boolean;
}

export async function fetchMyReferral(token: string): Promise<ReferralInfo> {
  const res = await netFetch(`${API_BASE_URL}/referrals/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to load referral info (${res.status})`));
  }
  return res.json();
}



// ---------------- Real notifications (client-side calls, new) ----------------
// Same reasoning as orders/wishlist/referrals above -- real logged-in
// account, browser-only. Reuses the SAME GET/PATCH /notifications/me*
// endpoints the mobile app already uses (migration 019) -- created by
// real order-status changes, return-status changes, support-ticket
// replies, price-drop alerts, and saved-search matches (see
// services/api/src/modules/notifications/routes.js's own header
// comment for the 4 real trigger points).

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  linkType: string | null;
  linkId: string | null;
  isRead: boolean;
  createdAt: string;
}

export async function fetchNotifications(token: string, lang?: Lang): Promise<Notification[]> {
  const res = await netFetch(`${API_BASE_URL}/notifications/me${lang === "ar" ? "?lang=ar" : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to load notifications (${res.status})`));
  }
  return res.json();
}

export async function fetchUnreadNotificationCount(token: string): Promise<number> {
  const res = await netFetch(`${API_BASE_URL}/notifications/me/unread-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return 0;
  const body = await res.json();
  return body.count;
}

export async function markNotificationRead(token: string, id: number): Promise<void> {
  await netFetch(`${API_BASE_URL}/notifications/me/${id}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await netFetch(`${API_BASE_URL}/notifications/me/read-all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Real deep-link resolution for a notification's real linkType/linkId.
// 'ticket' used to correctly resolve to null -- this storefront had no
// support-ticket UI at all. Now that /support/[id] is real, it
// resolves there instead.
export function resolveNotificationLink(n: Notification): string | null {
  if (!n.linkType || !n.linkId) return null;
  switch (n.linkType) {
    case "order": return `/orders/${n.linkId}`;
    case "product": return `/products/${n.linkId}`;
    case "saved_search": return "/saved-searches";
    case "ticket": return `/support/${n.linkId}`;
    default: return null;
  }
}

// ---------------- Real returns (client-side calls, new) ----------------
// Reuses the SAME real GET/POST /returns/my-cases* endpoints the
// mobile app already uses -- now genuinely guest-accessible too (a
// real gap closed this session: previously requireAuth only, so a
// guest who filed a return via POST /returns with guestEmail could
// never check on it again). A logged-in buyer passes `token`; a guest
// passes the real guestEmail their return was filed under instead --
// exactly mirroring GET /order/:id's own established
// account-or-matching-guestEmail pattern.

export interface ReturnCaseMessage {
  senderRole: string;
  message: string;
  createdAt: string;
}

export interface ReturnCaseDetail {
  id: string;
  orderId: string;
  subOrderId: number;
  buyerId: string | null;
  guestEmail: string | null;
  reason: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: ReturnCaseMessage[];
  photos: string[];
}

export interface ReturnCaseSummary {
  id: string;
  orderId: string;
  subOrderId: number;
  reason: string;
  status: string;
  updatedAt: string;
}

export async function fetchMyReturnCases(token: string): Promise<ReturnCaseSummary[]> {
  const res = await netFetch(`${API_BASE_URL}/returns/my-cases`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to load return cases (${res.status})`));
  }
  return res.json();
}

export async function fetchReturnCase(caseId: string, auth: { token?: string; guestEmail?: string }): Promise<ReturnCaseDetail> {
  const url = new URL(`${API_BASE_URL}/returns/my-cases/${caseId}`);
  if (auth.guestEmail) url.searchParams.set("guestEmail", auth.guestEmail);
  const res = await netFetch(url.toString(), {
    headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Return case not found (${res.status})`));
  }
  return res.json();
}

export async function sendReturnCaseMessage(caseId: string, message: string, auth: { token?: string; guestEmail?: string }): Promise<void> {
  const res = await netFetch(`${API_BASE_URL}/returns/my-cases/${caseId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
    body: JSON.stringify({ message, ...(auth.guestEmail ? { guestEmail: auth.guestEmail } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to send message (${res.status})`));
  }
}

// ---------------- Real vehicle fitment cascade (new) ----------------
// Reuses the SAME real GET /fitment/brands -> /brands/:id/models ->
// /models/:id/generations cascade the mobile app's own search vehicle
// filter and the supplier portal's product-submission form already
// use -- the real, populated Brand->Model->Generation system every
// real product's fitment is actually stored in.

export interface VehicleBrand {
  id: string;
  name: string;
  nameAr?: string | null;
  photoUrl?: string | null;
}

export interface VehicleModel {
  id: string;
  brandId: string;
  name: string;
  nameAr?: string | null;
}

export interface VehicleGeneration {
  id: string;
  modelId: string;
  name: string;
  yearStart: number;
  yearEnd: number | null;
  photoUrl?: string | null;
}

export async function fetchVehicleBrands(): Promise<VehicleBrand[]> {
  const data = await apiGet<VehicleBrand[]>("/fitment/brands");
  return data ?? [];
}

export async function fetchModelsForBrand(brandId: string): Promise<VehicleModel[]> {
  const data = await apiGet<VehicleModel[]>(`/fitment/brands/${brandId}/models`);
  return data ?? [];
}

export async function fetchGenerationsForModel(modelId: string): Promise<VehicleGeneration[]> {
  const data = await apiGet<VehicleGeneration[]>(`/fitment/models/${modelId}/generations`);
  return data ?? [];
}

// ---------------- Real support tickets (client-side calls, new) ----------------
// Reuses the SAME real GET/POST /support/my-tickets* endpoints the
// mobile app already uses -- now genuinely guest-accessible too (a
// real gap closed this session: previously requireAuth only, so a
// guest who filed a ticket via POST /support/tickets with guestEmail
// could never check on it again). Mirrors GET /order/:id and
// GET /returns/my-cases/:id's own established account-or-matching-
// guestEmail pattern exactly.

export interface SupportTicketMessage {
  senderRole: string;
  message: string;
  createdAt: string;
}

export interface SupportTicketDetail {
  id: string;
  subject: string;
  buyerId: string | null;
  guestEmail: string | null;
  orderId: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolutionHelpful?: boolean | null;
  messages: SupportTicketMessage[];
}

export interface SupportTicketSummary {
  id: string;
  subject: string;
  orderId: string | null;
  status: string;
  priority: string;
  updatedAt: string;
  createdAt?: string;
  /** null until the buyer says whether the resolution helped (only asked once the ticket is resolved or closed). */
  resolutionHelpful?: boolean | null;
}

export async function createSupportTicket(
  input: { subject: string; message: string; orderId?: string },
  auth: { token?: string; guestEmail?: string }
): Promise<{ id: string }> {
  const res = await netFetch(`${API_BASE_URL}/support/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
    body: JSON.stringify({ ...input, ...(auth.guestEmail ? { guestEmail: auth.guestEmail } : {}) }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(apiMessage(body.error) || apiMessage(`Failed to create ticket (${res.status})`));
  return body;
}

export async function fetchMyTickets(token: string): Promise<SupportTicketSummary[]> {
  const res = await netFetch(`${API_BASE_URL}/support/my-tickets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to load tickets (${res.status})`));
  }
  return res.json();
}

export async function fetchSupportTicket(ticketId: string, auth: { token?: string; guestEmail?: string }): Promise<SupportTicketDetail> {
  const url = new URL(`${API_BASE_URL}/support/my-tickets/${ticketId}`);
  if (auth.guestEmail) url.searchParams.set("guestEmail", auth.guestEmail);
  const res = await netFetch(url.toString(), {
    headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Ticket not found (${res.status})`));
  }
  return res.json();
}

export async function sendSupportTicketMessage(ticketId: string, message: string, auth: { token?: string; guestEmail?: string }): Promise<void> {
  const res = await netFetch(`${API_BASE_URL}/support/my-tickets/${ticketId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
    body: JSON.stringify({ message, ...(auth.guestEmail ? { guestEmail: auth.guestEmail } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiMessage(body.error) || apiMessage(`Failed to send message (${res.status})`));
  }
}

// ---------------------------------------------------------------- Stage 1b: garage, VIN, parts of a category, display rates

/** A car the buyer saved: one generation and one year, with the names in both languages and the photo to show. */
export interface GarageVehicle {
  generationId: string;
  year: number;
  brand: string;
  brandAr?: string | null;
  model: string;
  modelAr?: string | null;
  generation: string;
  yearStart: number;
  yearEnd: number | null;
  isDefault: boolean;
  brandPhotoUrl?: string | null;
  generationPhotoUrl?: string | null;
  /** The VERSION of the car (a row of the vehicle data the admin adds): null for a car saved before versions existed and for a year that has none. */
  versionId?: string | null;
  version?: GarageVersion | null;
  /** How many versions this car's year has: a car with none chosen but versionCount above 0 can be given its version ("Choose its version"). */
  versionCount?: number;
}

export interface GarageVersion { id: string; name: string; nameAr?: string | null; engine: string; engineAr?: string | null; seats: number; photoUrl?: string | null }

/** One version of a vehicle year, as the choosing step lists it (the Chinese texts are for suppliers and are not shown on the website). */
export interface VehicleVersion { id: string; generationId: string; name: string; nameAr?: string | null; nameZh?: string | null; engine: string; engineAr?: string | null; engineZh?: string | null; seats: number; photoUrl?: string | null; sortOrder?: number }

/** The versions of a year (empty when it has none, or when they could not be read: the server then asks for the version if one is needed). */
export async function fetchVersionsForGeneration(generationId: string): Promise<VehicleVersion[]> {
  return (await apiGet<VehicleVersion[]>(`/fitment/generations/${encodeURIComponent(generationId)}/versions`)) ?? [];
}

/** What a VIN says about its car (GET /fitment/vin-decode/:vin). */
export interface VinDecode {
  vin: string;
  isValidCheckDigit: boolean;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  source: string;
}

/** A part of a category (the sub-category: "Front Brake Disc" under "Brake System"). The English name is what the product filter takes. */
export interface CategoryPart {
  id: string;
  categoryId: string;
  nameEn: string;
  nameAr: string | null;
  sortOrder: number;
  photoUrl?: string | null;
}

async function authedJson<T>(token: string, path: string, method: string, failure: string, body?: unknown): Promise<T> {
  const res = await netFetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(apiMessage(data.error) || apiMessage(`${failure} (${res.status})`));
  }
  return (res.status === 204 ? undefined : await res.json().catch(() => undefined)) as T;
}

export const fetchMyGarage = (token: string) => authedJson<GarageVehicle[]>(token, "/garage/me", "GET", "Failed to load your garage");
// A car is its brand, model, year and (when the year has versions) VERSION. Removing and choosing the default act on that exact car.
const versionQuery = (versionId?: string | null) => (versionId ? `?versionId=${encodeURIComponent(versionId)}` : "");
export const addVehicleToGarage = (token: string, generationId: string, year: number, versionId?: string | null) => authedJson<GarageVehicle>(token, "/garage/me", "POST", "Failed to save the vehicle", { generationId, year, ...(versionId ? { versionId } : {}) });
export const removeVehicleFromGarage = (token: string, generationId: string, year: number, versionId?: string | null) => authedJson<void>(token, `/garage/me/${encodeURIComponent(generationId)}/${year}${versionQuery(versionId)}`, "DELETE", "Failed to remove the vehicle");
export const setDefaultVehicle = (token: string, generationId: string, year: number, versionId?: string | null) => authedJson<void>(token, `/garage/me/${encodeURIComponent(generationId)}/${year}/default${versionQuery(versionId)}`, "PATCH", "Failed to set the default vehicle");
/** Gives a car saved before versions existed (a car with no version) its version. Answers the whole garage. */
export const chooseGarageVersion = (token: string, generationId: string, year: number, versionId: string) => authedJson<GarageVehicle[]>(token, `/garage/me/${encodeURIComponent(generationId)}/${year}/version`, "PATCH", "Failed to save the version", { versionId });

/** Decodes a VIN. Throws with the server's own message when it is not a valid VIN (17 characters, no I, O or Q). */
export async function decodeVin(vin: string): Promise<VinDecode> {
  const res = await netFetch(`${API_BASE_URL}/fitment/vin-decode/${encodeURIComponent(vin.trim().toUpperCase())}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiMessage(data.error) || apiMessage(`Could not look up this VIN (${res.status})`));
  return data as VinDecode;
}

export async function fetchPartsForCategory(categoryId: string): Promise<CategoryPart[]> {
  const data = await apiGet<CategoryPart[]>(`/catalog/categories/${encodeURIComponent(categoryId)}/parts`);
  return data ?? [];
}

/** USD to each currency, for DISPLAY only (the order is still placed in US dollars). */
export async function fetchDisplayRates(): Promise<Record<string, number>> {
  const data = await apiGet<{ rates: Record<string, number> }>("/pricing/display-rates");
  return data?.rates ?? {};
}

// ---------------------------------------------------------------- Stage 1c: the rest of the product page

/** The sections under a product: the same part from other suppliers, similar parts, more of the brand. Each is the buyer-facing product shape, in the page's language. */
async function productList(path: string, lang?: Lang, extra: Record<string, string | number> = {}): Promise<ProductSummary[]> {
  const query = new URLSearchParams(Object.entries(extra).map(([k, v]) => [k, String(v)]));
  if (lang === "ar") query.set("lang", "ar");
  const qs = query.toString();
  return (await apiGet<ProductSummary[]>(`${path}${qs ? `?${qs}` : ""}`)) ?? [];
}
/** The same OEM part number, listed by other suppliers (empty when the product has no OEM number). */
export const fetchOemAlternatives = (id: string, lang?: Lang) => productList(`/catalog/products/${encodeURIComponent(id)}/oem-alternatives`, lang);
/** Similar parts (the same part or category, and the same vehicle model). */
export const fetchAlternatives = (id: string, lang?: Lang) => productList(`/catalog/products/${encodeURIComponent(id)}/alternatives`, lang);
/** More parts for the same vehicle brand, 10 a page, without anything already shown above. */
export const fetchSameBrand = (id: string, lang?: Lang, page = 1, limit?: number) => productList(`/catalog/products/${encodeURIComponent(id)}/same-brand`, lang, limit ? { page, limit } : { page });
/** More parts for the same vehicle MODEL (any section), without the part itself. */
export const fetchSameModel = (id: string, lang?: Lang, page = 1, limit?: number) => productList(`/catalog/products/${encodeURIComponent(id)}/same-model`, lang, limit ? { page, limit } : { page });

/** A review as its author sees it (with its moderation status). */
export interface MyReview {
  id: number;
  productId: string;
  rating: number;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  photos: string[];
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}
export async function fetchMyReviews(token: string): Promise<MyReview[]> {
  const res = await netFetch(`${API_BASE_URL}/reviews/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(apiMessage(`Failed to load your reviews (${res.status})`));
  return res.json();
}

/** Reports a review to the moderators, with the buyer's reason. */
export async function flagReview(token: string, reviewId: number, reason: string): Promise<void> {
  const res = await netFetch(`${API_BASE_URL}/reviews/${reviewId}/flag`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Failed to report the review (${res.status})`, body.code, res.status);
  }
}

// ---------------------------------------------------------------- Stage 3a: orders after the sale

export interface AnnualSpend { year: number; orderCount: number; totalSpent: number; currencyCode: string }
export const fetchAnnualSpend = (token: string, year?: number) => orderCall<AnnualSpend>("/me/annual-summary", { token }, { query: year ? { year: String(year) } : {} }, "Failed to load your spending");

export interface TrackingStep { time: string; description: string; kind: string; location: string | null; source: string }
export interface SubOrderTracking { subOrderId: number; supplierTrackingNumber: string | null; hubTrackingNumber: string | null; timeline: TrackingStep[]; isDelayed: boolean }
export interface OrderTracking { orderId: string; subOrders: SubOrderTracking[] }
/** The live tracking of every part of an order, with the steps in the page's language. */
export const fetchOrderTracking = (orderId: string, who: OrderWho, lang?: Lang) =>
  orderCall<OrderTracking>(`/${encodeURIComponent(orderId)}/tracking`, who, { query: lang === "ar" ? { lang: "ar" } : {} }, "Failed to load tracking");

export const cancelOrder = (orderId: string, who: OrderWho) => orderCall<{ status?: string }>(`/${encodeURIComponent(orderId)}/cancel`, who, { method: "POST", body: {} }, "Failed to cancel the order");
export const cancelSubOrder = (orderId: string, subOrderId: number, who: OrderWho) => orderCall<{ status?: string }>(`/${encodeURIComponent(orderId)}/sub-orders/${subOrderId}/cancel`, who, { method: "POST", body: {} }, "Failed to cancel this part");

/** Confirms the English version of the address as it is, or with the buyer's edits (English letters only: the server refuses anything else). */
export const confirmEnglishAddress = (orderId: string, who: OrderWho, edits?: { recipientName: string; country: string; city: string; streetAddress: string; state?: string }) =>
  orderCall<EnglishAddress>(`/${encodeURIComponent(orderId)}/address-english/confirm`, who, { method: "PUT", body: edits ?? {} }, "Failed to confirm the address");

/** The receipt as a PDF (the sign-in token goes in a header, not in the address, so it can never end up in a link, a history or a log). */
export async function fetchOrderReceipt(orderId: string, who: OrderWho, lang?: Lang): Promise<Blob> {
  const query = new URLSearchParams();
  if (lang === "ar") query.set("lang", "ar");
  if (!who.token && who.guestEmail) query.set("guestEmail", who.guestEmail);
  const res = await netFetch(`${API_BASE_URL}/order/${encodeURIComponent(orderId)}/receipt?${query.toString()}`, { headers: who.token ? { Authorization: `Bearer ${who.token}` } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(apiMessage(data.error) || apiMessage(`Failed to load the receipt (${res.status})`));
  }
  return res.blob();
}

/** A return request for one part of an order (the server enforces the return window after delivery). A guest gives their email; photos are for signed-in buyers. */
export async function createReturnCase(input: { subOrderId: number; reason: string; message: string; photos?: string[] }, who: OrderWho): Promise<{ id: string }> {
  const res = await netFetch(`${API_BASE_URL}/returns`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(who.token ? { Authorization: `Bearer ${who.token}` } : {}) },
    body: JSON.stringify({ ...input, ...(who.token ? {} : { guestEmail: who.guestEmail }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiMessage(data.error) || apiMessage(`Failed to send the return request (${res.status})`));
  return data as { id: string };
}

// ---------------------------------------------------------------- Stage 3b: ticket feedback and bug reports

/** "Was this resolution helpful?": only accepted once the ticket is resolved or closed (the server refuses it before, and says so). */
export async function submitTicketFeedback(ticketId: string, helpful: boolean, auth: { token?: string | null; guestEmail?: string | null }): Promise<{ id: string; resolutionHelpful: boolean }> {
  const res = await netFetch(`${API_BASE_URL}/support/my-tickets/${encodeURIComponent(ticketId)}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
    body: JSON.stringify({ helpful, ...(!auth.token && auth.guestEmail ? { guestEmail: auth.guestEmail } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiMessage(data.error) || apiMessage(`Failed to send feedback (${res.status})`));
  return data;
}

/** A bug report (anyone may send one; a screenshot is a photo uploaded first, which needs a signed-in buyer, like the app). */
export async function submitBugReport(input: { description: string; screenshotUrl?: string | null; deviceInfo?: string }, token?: string | null): Promise<{ id: number; createdAt: string }> {
  const res = await netFetch(`${API_BASE_URL}/bug-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(apiMessage(data.error) || apiMessage(`Failed to send the report (${res.status})`));
  return data;
}

// ---------------------------------------------------------------- Stage 4a: account and sign-in security

/** One loyalty tier. `color` and `icon` are names the server sends ("amber", "award"); lib/loyalty.ts turns them into what the page shows. */
export interface LoyaltyTier { id: number | string; name: string; nameAr?: string | null; color: string; icon: string; discountPercentage: number; spendThreshold: number }
export interface LoyaltyStatus { currentTier: LoyaltyTier | null; nextTier: LoyaltyTier | null; progressPercent: number; lifetimeSpend: number; amountToNextTier: number | null; allTiers: LoyaltyTier[] }
export const fetchLoyaltyStatus = (token: string) => authedJson<LoyaltyStatus>(token, "/loyalty/me", "GET", "Failed to load your loyalty status");

/** Changes the sign-in email (the current password is asked for). The server answers with a NEW sign-in token for the new email, which the page must adopt. */
export const changeEmail = (token: string, newEmail: string, currentPassword: string) =>
  authedJson<{ token: string; user: { id: string; email: string; name: string | null; role: string } }>(token, "/auth/me/email", "PATCH", "Failed to change your email", { newEmail, currentPassword });
export const updateAvatar = (token: string, avatarUrl: string | null) => authedJson<{ avatarUrl: string | null }>(token, "/auth/me/avatar", "PATCH", "Failed to update your photo", { avatarUrl });
/** Deletes the account (the password confirms it): personal info goes, the order history is kept. */
export const deleteAccount = (token: string, password: string) => authedJson<void>(token, "/auth/me/delete", "POST", "Failed to delete the account", { password });

export const setupTwoFactor = (token: string) => authedJson<{ secret: string; qrCodeDataUrl: string }>(token, "/auth/2fa/setup", "POST", "Failed to start two-factor setup");
export const confirmTwoFactor = (token: string, code: string) => authedJson<unknown>(token, "/auth/2fa/confirm", "POST", "Failed to turn on two-factor authentication", { code });
export const disableTwoFactor = (token: string, password: string) => authedJson<unknown>(token, "/auth/2fa/disable", "POST", "Failed to turn off two-factor authentication", { password });

/** Asks for a reset email. The answer is always the same whether or not the address is registered (so nobody can find out who has an account). The link opens a page the SERVER serves. */
export async function forgotPassword(email: string): Promise<void> {
  const res = await netFetch(`${API_BASE_URL}/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(apiMessage(data.error) || apiMessage(`Failed to send the reset link (${res.status})`));
  }
}

// ---------------------------------------------------------------- Stage 4b: quote requests ("My requests"), referral history

export type QuoteItemStatus = "pending" | "priced" | "unavailable" | string;
export interface QuoteRequestItem {
  id: number;
  name: string;
  description: string | null;
  referencePhotoUrl: string | null;
  quantity: number;
  status: QuoteItemStatus;
  /** Set once the Leap team made the part (a real product): the price is the buyer's own, in US dollars. */
  productId: string | null;
  price?: number;
  currencyCode?: string;
  /** The made product has been approved and can be bought. */
  readyToOrder?: boolean;
}
export type QuoteRequestStatus = "draft" | "submitted" | "quoted" | "ordered" | "cancelled" | string;
export interface QuoteRequest {
  id: string;
  generationId: string;
  year: number;
  brand: string | null;
  model: string | null;
  generation: string | null;
  status: QuoteRequestStatus;
  createdAt: string;
  submittedAt: string | null;
  quotedAt: string | null;
  /** A quote is valid for 7 days from when it was sent. */
  expiresAt: string | null;
  items: QuoteRequestItem[];
}

export const createQuoteRequest = (token: string, generationId: string, year: number) => authedJson<QuoteRequest>(token, "/quote-requests", "POST", "Failed to start the request", { generationId, year });
export const fetchMyQuoteRequests = (token: string) => authedJson<QuoteRequest[]>(token, "/quote-requests/mine", "GET", "Failed to load your requests");
export const fetchQuoteRequest = (token: string, id: string) => authedJson<QuoteRequest>(token, `/quote-requests/${encodeURIComponent(id)}`, "GET", "Failed to load this request");
export const addQuoteRequestItem = (token: string, id: string, item: { name: string; description?: string | null; referencePhotoUrl?: string | null; quantity?: number }) =>
  authedJson<QuoteRequest>(token, `/quote-requests/${encodeURIComponent(id)}/items`, "POST", "Failed to add the part", item);
export const updateQuoteRequestItem = (token: string, id: string, itemId: number, changes: { quantity?: number; name?: string; description?: string | null; referencePhotoUrl?: string | null }) =>
  authedJson<QuoteRequest>(token, `/quote-requests/${encodeURIComponent(id)}/items/${itemId}`, "PATCH", "Failed to change the part", changes);
export const deleteQuoteRequestItem = (token: string, id: string, itemId: number) => authedJson<QuoteRequest>(token, `/quote-requests/${encodeURIComponent(id)}/items/${itemId}`, "DELETE", "Failed to remove the part");
export const submitQuoteRequest = (token: string, id: string) => authedJson<QuoteRequest>(token, `/quote-requests/${encodeURIComponent(id)}/submit`, "POST", "Failed to send the request");
export const cancelQuoteRequest = (token: string, id: string) => authedJson<QuoteRequest>(token, `/quote-requests/${encodeURIComponent(id)}/cancel`, "POST", "Failed to cancel the request");
/** Puts the quote's ready items in the given cart (the buyer then checks out as usual). */
export const placeQuoteRequestOrder = (token: string, id: string, cartId: string) => authedJson<QuoteRequest>(token, `/quote-requests/${encodeURIComponent(id)}/place-order`, "POST", "Failed to add the quote to your cart", { cartId });

export interface ReferralHistoryEntry { firstName: string | null; joinedAt: string; rewardGranted: boolean }
export const fetchReferralHistory = (token: string) => authedJson<ReferralHistoryEntry[]>(token, "/referrals/me/history", "GET", "Failed to load the referral history");

// ---------------------------------------------------------------- the home page's announcement line

import type { Announcement } from "./announcements";
/** How long the website keeps the announcements before asking again. Short on purpose: it is one tiny setting, and an admin who saves a change expects to see it on the home page within seconds, not minutes (the lists of products are cached longer). */
export const ANNOUNCEMENTS_REVALIDATE_SECONDS = 10;

/** The announcements an admin set. Anything wrong (the shop unreachable, an odd answer) means no bar: the home page always loads. */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  try {
    const res = await netFetch(`${API_BASE_URL}/platform-settings/announcements`, { next: { revalidate: ANNOUNCEMENTS_REVALIDATE_SECONDS } });
    if (!res.ok) return [];
    const body = await res.json();
    if (!Array.isArray(body?.announcements)) return [];
    return body.announcements
      .filter((x: unknown): x is Announcement => !!x && typeof (x as Announcement).en === "string" && (x as Announcement).en.trim() !== "")
      .map((x: Announcement) => ({ en: x.en, ar: typeof x.ar === "string" ? x.ar : "" }))
      .slice(0, 5);
  } catch {
    return [];
  }
}
