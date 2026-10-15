import { describe, it, expect } from "vitest";
import type { MyReview, ReviewsSummary } from "./api";
import { MAX_REVIEW_PHOTOS, REVIEW_BATCH, canAddPhoto, customerPhotos, myReviewOf, reviewErrorKey, reviewState, wholeStars } from "./review";

const mine = (over: Partial<MyReview> = {}): MyReview => ({ id: 1, productId: "p1", rating: 5, comment: null, status: "pending", photos: [], isVerifiedPurchase: true, createdAt: "2026-01-01", updatedAt: "2026-01-01", ...over });
const review = (id: number, createdAt: string, photos: string[]): ReviewsSummary["reviews"][number] => ({ id, buyerName: "B", rating: 5, comment: null, createdAt, photos, isVerifiedPurchase: true });

describe("review rules (the app's and the server's)", () => {
  it("the limits are the app's: 3 photos, shown 3 reviews at a time", () => {
    expect(MAX_REVIEW_PHOTOS).toBe(3);
    expect(REVIEW_BATCH).toBe(3);
  });

  it("the buyer's own review of THIS part is found among all theirs, with its state", () => {
    const all = [mine({ id: 1, productId: "p9", status: "approved" }), mine({ id: 2, productId: "p1", status: "rejected" })];
    expect(myReviewOf("p1", all)?.id).toBe(2);
    expect(reviewState(myReviewOf("p1", all))).toBe("rejected");
    expect(reviewState(myReviewOf("p9", all))).toBe("approved");
    expect(myReviewOf("none", all)).toBeNull();
    expect(reviewState(null)).toBe("none");
    expect(reviewState(mine({ status: "pending" }))).toBe("pending");
  });

  it("CRITICAL: a review the server refused for want of a purchase gets its own message; anything else is the generic one, never the server's English sentence", () => {
    expect(reviewErrorKey("review_requires_purchase")).toBe("review_requires_purchase");
    expect(reviewErrorKey("photo_upload_failed")).toBe("generic_error");
    expect(reviewErrorKey(undefined)).toBe("generic_error");
  });

  it("customer photos: every photo of every review, newest review first, each once", () => {
    const rs = [review(1, "2026-01-01", ["/a.jpg", "/b.jpg"]), review(2, "2026-03-01", ["/c.jpg", "/a.jpg"]), review(3, "2026-02-01", [])];
    expect(customerPhotos(rs)).toEqual(["/c.jpg", "/a.jpg", "/b.jpg"]);
    expect(customerPhotos([])).toEqual([]);
    expect(rs[0].createdAt).toBe("2026-01-01");                      // the list that was passed in is not reordered
  });

  it("CRITICAL: a photo is added only while there is room (up to 3) and only if it is an image", () => {
    expect(canAddPhoto(0, { type: "image/jpeg" })).toBe(true);
    expect(canAddPhoto(2, { type: "image/png" })).toBe(true);
    expect(canAddPhoto(3, { type: "image/png" })).toBe(false);
    expect(canAddPhoto(0, { type: "application/pdf" })).toBe(false);
    expect(canAddPhoto(0, { type: "" })).toBe(false);
  });

  it("the average is shown as whole stars, rounded", () => {
    expect(wholeStars(4.5)).toBe(5);
    expect(wholeStars(4.4)).toBe(4);
    expect(wholeStars(null)).toBe(0);
  });
});
