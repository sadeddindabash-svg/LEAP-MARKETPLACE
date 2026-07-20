import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

async function createSignedUpBuyer() {
  const suffix = Date.now() + Math.random();
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `review-flag-test-${suffix}@example.com`, password: 'test_password_123' }),
  });
  return res.json();
}

async function createReview(buyerToken, productId = 'p4') {
  const res = await fetch(`${BACKEND_URL}/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
    body: JSON.stringify({ productId, rating: 1, comment: 'flag test content' }),
  });
  return res.json();
}

describe.runIf(backendUp)('real review flagging/reporting against a REAL running backend', () => {
  it('CRITICAL: flagging without a real reason is rejected; with one, it succeeds', async () => {
    const author = await createSignedUpBuyer();
    const flagger = await createSignedUpBuyer();
    const review = await createReview(author.token);

    const noReason = await fetch(`${BACKEND_URL}/reviews/${review.id}/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${flagger.token}` },
      body: JSON.stringify({}),
    });
    expect(noReason.status).toBe(400);

    const withReason = await fetch(`${BACKEND_URL}/reviews/${review.id}/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${flagger.token}` },
      body: JSON.stringify({ reason: 'Offensive language' }),
    });
    expect(withReason.status).toBe(201);
  });

  it('CRITICAL: re-flagging the same review by the same buyer is a real, genuine no-op, not an error or a duplicate', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const author = await createSignedUpBuyer();
    const flagger = await createSignedUpBuyer();
    const review = await createReview(author.token);

    await fetch(`${BACKEND_URL}/reviews/${review.id}/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${flagger.token}` },
      body: JSON.stringify({ reason: 'First reason' }),
    });
    const second = await fetch(`${BACKEND_URL}/reviews/${review.id}/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${flagger.token}` },
      body: JSON.stringify({ reason: 'Second reason' }),
    });
    expect(second.status).toBe(201);

    const flagged = await fetch(`${BACKEND_URL}/reviews/flagged`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    expect(flagged.find((r) => r.id === review.id).flagCount).toBe(1);
  });

  it('CRITICAL: the real admin flagged queue shows the review with its flag count and every real reason given', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const author = await createSignedUpBuyer();
    const flagger1 = await createSignedUpBuyer();
    const flagger2 = await createSignedUpBuyer();
    const review = await createReview(author.token);

    await fetch(`${BACKEND_URL}/reviews/${review.id}/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${flagger1.token}` },
      body: JSON.stringify({ reason: 'Reason A' }),
    });
    await fetch(`${BACKEND_URL}/reviews/${review.id}/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${flagger2.token}` },
      body: JSON.stringify({ reason: 'Reason B' }),
    });

    const flagged = await fetch(`${BACKEND_URL}/reviews/flagged`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    const entry = flagged.find((r) => r.id === review.id);
    expect(entry.flagCount).toBe(2);
    expect(entry.flagReasons.sort()).toEqual(['Reason A', 'Reason B']);
  });

  it('CRITICAL: dismissing flags clears them and removes the review from the real queue, without changing its status', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const author = await createSignedUpBuyer();
    const flagger = await createSignedUpBuyer();
    const review = await createReview(author.token);
    await fetch(`${BACKEND_URL}/reviews/${review.id}/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${flagger.token}` },
      body: JSON.stringify({ reason: 'Testing dismiss' }),
    });

    const dismissRes = await fetch(`${BACKEND_URL}/reviews/${review.id}/dismiss-flags`, {
      method: 'POST', headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(dismissRes.status).toBe(200);
    expect((await dismissRes.json()).dismissedCount).toBe(1);

    const flagged = await fetch(`${BACKEND_URL}/reviews/flagged`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    expect(flagged.find((r) => r.id === review.id)).toBeUndefined();

    const myReviews = await fetch(`${BACKEND_URL}/reviews/me`, { headers: { Authorization: `Bearer ${author.token}` } }).then((r) => r.json());
    expect(myReviews.find((r) => r.id === review.id).status).toBe('pending');
  });

  it('CRITICAL: non-admins cannot see the flagged queue or dismiss flags', async () => {
    const buyer = await createSignedUpBuyer();
    const queueRes = await fetch(`${BACKEND_URL}/reviews/flagged`, { headers: { Authorization: `Bearer ${buyer.token}` } });
    expect(queueRes.status).toBe(403);

    const dismissRes = await fetch(`${BACKEND_URL}/reviews/1/dismiss-flags`, { method: 'POST', headers: { Authorization: `Bearer ${buyer.token}` } });
    expect(dismissRes.status).toBe(403);
  });

  it('flagging a nonexistent review is rejected with a real 404', async () => {
    const buyer = await createSignedUpBuyer();
    const res = await fetch(`${BACKEND_URL}/reviews/99999999/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ reason: 'Test' }),
    });
    expect(res.status).toBe(404);
  });
});
