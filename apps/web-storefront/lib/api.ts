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
  status: string;
  price: number;
  images: string[];
}

export interface ProductDetail extends ProductSummary {
  brand: string | null;
  model: string | null;
  year: number | null;
  fitsVehicleIds: string[];
}

export interface ProductCategory {
  id: string;
  nameEn: string;
  nameAr: string;
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
    const res = await fetch(`${API_BASE_URL}${path}`, {
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
} = {}): Promise<ProductSummary[]> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  const qs = query.toString();
  const data = await apiGet<ProductSummary[]>(`/catalog/products${qs ? `?${qs}` : ""}`);
  return data ?? [];
}

export async function fetchProductById(id: string): Promise<ProductDetail | null> {
  return apiGet<ProductDetail>(`/catalog/products/${id}`);
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
  currencyCode: string;
  supplierName: string | null;
  // Real, live stock quantity (new) -- see services/api/src/modules/
  // cart/routes.js's own comment on why this is an early warning, not
  // a reservation.
  stockQuantity: number;
}

export interface Cart {
  cartId: string;
  items: CartItem[];
}

async function cartApiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/cart${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Cart request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function fetchCart(cartId: string): Promise<Cart> {
  return cartApiCall<Cart>(`/${cartId}`);
}

export function addCartItem(cartId: string, productId: string, quantity: number): Promise<Cart> {
  return cartApiCall<Cart>(`/${cartId}/items`, {
    method: "POST",
    body: JSON.stringify({ productId, quantity }),
  });
}

export function setCartItemQuantity(cartId: string, productId: string, quantity: number): Promise<Cart> {
  return cartApiCall<Cart>(`/${cartId}/items/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(cartId: string, productId: string): Promise<Cart> {
  return cartApiCall<Cart>(`/${cartId}/items/${productId}`, { method: "DELETE" });
}

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

export async function placeGuestOrder(
  items: Array<{ productId: string; quantity: number }>,
  guestEmail: string,
  address: PlaceOrderAddress
): Promise<PlaceOrderResult> {
  const res = await fetch(`${API_BASE_URL}/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, guestEmail, address }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Failed to place order (${res.status})`);
  return body as PlaceOrderResult;
}

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
  const res = await fetch(`${API_BASE_URL}/saved-searches${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Saved search request failed (${res.status})`);
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
  const res = await fetch(`${API_BASE_URL}/saved-searches/me/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to delete saved search (${res.status})`);
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
}

export interface HubShipmentEvent {
  step: string;
  notes: string | null;
  trackingNumber: string | null;
  performedBy: string | null;
  createdAt: string;
  photos: string[];
}

export interface HubShipment {
  id: number;
  status: string;
  updatedAt: string;
  events: HubShipmentEvent[];
}

export interface OrderLineItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
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

export interface OrderDetail {
  id: string;
  userId: string | null;
  guestEmail: string | null;
  isGuestOrder: boolean;
  status: string;
  displayStatus: string;
  total: number;
  discountAmount: number;
  promoCode: string | null;
  currencyCode: string;
  placedAt: string;
  address: OrderAddress | null;
  supplierSubOrders: SupplierSubOrder[];
}

export async function fetchMyOrders(token: string): Promise<OrderSummary[]> {
  const res = await fetch(`${API_BASE_URL}/order`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load orders (${res.status})`);
  }
  return res.json();
}

export async function fetchOrderById(token: string, orderId: string): Promise<OrderDetail> {
  const res = await fetch(`${API_BASE_URL}/order/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load order (${res.status})`);
  }
  return res.json();
}

// ---------------- Real wishlist (client-side calls, new) ----------------
// Same reasoning as saved searches/orders above -- real logged-in
// account, browser-only. Reuses ProductSummary since the backend's
// GET /wishlist/me genuinely returns the same product DTO shape as
// GET /catalog/products (see services/api/src/modules/wishlist/routes.js,
// which reuses the catalog module's own DTO-building helpers directly
// rather than a separate wishlist-specific shape).

export async function fetchWishlist(token: string): Promise<ProductSummary[]> {
  const res = await fetch(`${API_BASE_URL}/wishlist/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load wishlist (${res.status})`);
  }
  return res.json();
}

export async function checkWishlisted(token: string, productId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/wishlist/me/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const body = await res.json();
  return body.wishlisted;
}

export async function addToWishlist(token: string, productId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/wishlist/me/${productId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to add to wishlist (${res.status})`);
  }
}

export async function removeFromWishlist(token: string, productId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/wishlist/me/${productId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to remove from wishlist (${res.status})`);
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

export async function submitReview(
  token: string,
  params: { productId: string; rating: number; comment?: string; photos?: string[] }
): Promise<SubmittedReview> {
  const res = await fetch(`${API_BASE_URL}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Failed to submit review (${res.status})`);
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
  const res = await fetch(`${API_BASE_URL}/uploads/product-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Failed to upload photo (${res.status})`);
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
  const res = await fetch(`${API_BASE_URL}/referrals/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load referral info (${res.status})`);
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

export async function fetchNotifications(token: string): Promise<Notification[]> {
  const res = await fetch(`${API_BASE_URL}/notifications/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load notifications (${res.status})`);
  }
  return res.json();
}

export async function fetchUnreadNotificationCount(token: string): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/notifications/me/unread-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return 0;
  const body = await res.json();
  return body.count;
}

export async function markNotificationRead(token: string, id: number): Promise<void> {
  await fetch(`${API_BASE_URL}/notifications/me/${id}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/notifications/me/read-all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Real deep-link resolution for a notification's real linkType/linkId
// -- 'ticket' deliberately has no real page here (this storefront has
// no support-ticket UI at all, unlike the mobile app), so it's an
// honest null rather than a link to a page that doesn't exist.
export function resolveNotificationLink(n: Notification): string | null {
  if (!n.linkType || !n.linkId) return null;
  switch (n.linkType) {
    case "order": return `/orders/${n.linkId}`;
    case "product": return `/products/${n.linkId}`;
    case "saved_search": return "/saved-searches";
    default: return null;
  }
}
