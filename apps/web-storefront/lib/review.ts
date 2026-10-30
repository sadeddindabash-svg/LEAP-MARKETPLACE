// The rules of reviews, the same as the mobile app's and the server's: one review per buyer per part, 1 to 5 stars, a comment that is optional, at most 3 photos, shown three
// at a time. A review is approved by a moderator before everybody sees it, so its author sees where it stands.
import type { MyReview, ReviewsSummary } from "./api";
import type { DictKey } from "./i18n";

export const MAX_REVIEW_PHOTOS = 3;
export const REVIEW_BATCH = 3;

export type ReviewState = "none" | "pending" | "approved" | "rejected";

/** The buyer's own review of this part (the server keeps one per buyer and part), and where it stands. */
export function myReviewOf(productId: string, mine: MyReview[]): MyReview | null {
  return mine.find((r) => r.productId === productId) ?? null;
}
export const reviewState = (review: MyReview | null): ReviewState => (review ? review.status : "none");

/** The text for a review the server refused: its code first (so it is in the buyer's language), then a generic message. Never the server's English sentence. */
export function reviewErrorKey(code: string | undefined): DictKey {
  if (code === "review_requires_purchase") return "review_requires_purchase";
  return "generic_error";
}

/** Every photo of every review of the part, newest review first, each once: the "Customer photos" section. */
export function customerPhotos(reviews: ReviewsSummary["reviews"]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...reviews].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))) {
    for (const url of r.photos) if (!seen.has(url)) { seen.add(url); out.push(url); }
  }
  return out;
}

/** Whether a photo can be added: a real image, and room for it. */
export function canAddPhoto(current: number, file: { type: string }): boolean {
  return current < MAX_REVIEW_PHOTOS && file.type.startsWith("image/");
}

/** The 5 average-rating stars as whole stars, rounded like the app. */
export const wholeStars = (average: number | null): number => (average == null ? 0 : Math.round(average));

/** What a product card shows about reviews: the average to one decimal, the count and the whole stars; null when the part has no approved review (the card says "No reviews yet"). */
export function cardReviews(rating: number | null | undefined, count: number | null | undefined): { average: string; count: number; fullStars: number } | null {
  if (!count || count <= 0 || rating == null || !Number.isFinite(rating)) return null;
  return { average: rating.toFixed(1), count, fullStars: Math.round(rating) };
}

/** A reviewer's name as other buyers see it: the first 2 letters in capitals, ***, the last 2 ("michael" -> "MI***el"). 4 letters or fewer: the first and *** ("Ali" -> "A***"). Spaces are ignored. Empty -> null (the page shows "Buyer"). */
export function maskReviewerName(name: string | null | undefined): string | null {
  if (!name) return null;
  const chars = Array.from(name.replace(/\s+/g, ""));
  if (chars.length === 0) return null;
  if (chars.length <= 4) return `${chars[0].toUpperCase()}***`;
  return `${chars[0]}${chars[1]}`.toUpperCase() + "***" + chars.slice(-2).join("");
}
