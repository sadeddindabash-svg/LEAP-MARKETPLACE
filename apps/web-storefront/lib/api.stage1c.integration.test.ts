import { describe, it, expect } from 'vitest';
import { ApiError, fetchAlternatives, fetchMyReviews, fetchOemAlternatives, fetchProductReviews, fetchSameBrand, flagReview, submitReview } from './api';

// Stage 1c's calls against a REAL running backend: the other listings of an OEM number, similar parts, more of the brand (paged), reviews and reporting.
const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp(): Promise<boolean> {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();
let counter = 0;
async function newBuyer(): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `stage1c-${Date.now()}-${++counter}@leap.dev`, password: 'stage1c_password_123', name: 'Stage 1c Buyer' }) });
  expect(res.status).toBe(201);
  return (await res.json()).token;
}
async function aProductWithReviews(): Promise<{ id: string; reviewId: number } | null> {
  const list = await (await fetch(`${BACKEND_URL}/catalog/products?limit=60`)).json();
  for (const p of (Array.isArray(list) ? list : list.items) as Array<{ id: string }>) {
    const reviews = await fetchProductReviews(p.id);
    if (reviews.reviews.length > 0) return { id: p.id, reviewId: reviews.reviews[0].id };
  }
  return null;
}

describe.runIf(backendUp)('stage 1c: the product page\'s calls against a REAL backend', () => {
  it('CRITICAL: the other-listings, similar-parts and same-brand calls return product lists that never include the part itself', async () => {
    const [oem, alternatives, sameBrand] = await Promise.all([fetchOemAlternatives('p1'), fetchAlternatives('p1'), fetchSameBrand('p1', 'en', 1)]);
    for (const list of [oem, alternatives, sameBrand]) {
      expect(Array.isArray(list)).toBe(true);
      expect(list.some((p) => p.id === 'p1')).toBe(false);
      for (const p of list) { expect(typeof p.id).toBe('string'); expect(typeof p.price).toBe('number'); }
    }
    expect(sameBrand.length).toBeLessThanOrEqual(10);                                       // ten a page
  }, 60000);

  it('same-brand pages do not repeat each other, a page is at most ten, and an unknown part gives an empty list (not an error)', async () => {
    const first = await fetchSameBrand('p1', 'en', 1);
    const second = await fetchSameBrand('p1', 'en', 2);
    const firstIds = new Set(first.map((p) => p.id));
    expect(second.every((p) => !firstIds.has(p.id))).toBe(true);
    expect(second.length).toBeLessThanOrEqual(10);
    expect(await fetchOemAlternatives('product_that_does_not_exist')).toEqual([]);
    expect(await fetchAlternatives('product_that_does_not_exist')).toEqual([]);
    expect(await fetchSameBrand('product_that_does_not_exist')).toEqual([]);
  }, 60000);

  it('CRITICAL: a review is refused for want of a purchase with a CODE the page can word itself, or (when the shop does not require one) accepted and then edited, never duplicated', async () => {
    const token = await newBuyer();
    let outcome: 'refused' | 'accepted';
    try {
      await submitReview(token, { productId: 'p1', rating: 4, comment: 'First' });
      outcome = 'accepted';
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('review_requires_purchase');
      expect((err as ApiError).status).toBe(403);
      outcome = 'refused';
    }
    const mine = await fetchMyReviews(token);
    if (outcome === 'refused') { expect(mine).toEqual([]); return; }
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ productId: 'p1', rating: 4, comment: 'First', status: 'pending' });
    await submitReview(token, { productId: 'p1', rating: 2, comment: 'Edited', photos: [] });
    const after = await fetchMyReviews(token);
    expect(after).toHaveLength(1);                                                           // edited, not duplicated
    expect(after[0]).toMatchObject({ id: mine[0].id, rating: 2, comment: 'Edited', status: 'pending' });
  }, 60000);

  it('a rating outside 1 to 5 is refused by the server', async () => {
    const token = await newBuyer();
    await expect(submitReview(token, { productId: 'p1', rating: 9 })).rejects.toThrow(/rating/);
    await expect(submitReview(token, { productId: 'p1', rating: 0 })).rejects.toThrow(/rating/);
  }, 30000);

  it('CRITICAL: reporting a review needs a reason; with one it is accepted', async () => {
    const target = await aProductWithReviews();
    if (!target) return;                                                                      // a database with no reviews has nothing to report
    const token = await newBuyer();
    await expect(flagReview(token, target.reviewId, '')).rejects.toBeInstanceOf(ApiError);
    await expect(flagReview(token, target.reviewId, 'Spam, from the stage 1c test')).resolves.toBeUndefined();
    await expect(flagReview('not-a-token', target.reviewId, 'x')).rejects.toBeInstanceOf(ApiError);
  }, 120000);
});
