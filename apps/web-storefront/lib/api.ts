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
