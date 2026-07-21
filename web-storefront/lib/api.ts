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

