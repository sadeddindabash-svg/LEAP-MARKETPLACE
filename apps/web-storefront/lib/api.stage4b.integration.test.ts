import { describe, it, expect } from 'vitest';
import {
  addQuoteRequestItem, addToWishlist, cancelQuoteRequest, createAddress, createQuoteRequest, createSavedSearch, deleteQuoteRequestItem, deleteSavedSearch, fetchMyQuoteRequests, fetchMyReferral, fetchNotifications,
  fetchQuoteRequest, fetchReferralHistory, fetchSavedSearches, fetchUnreadNotificationCount, fetchWishlist, markAllNotificationsRead, markNotificationRead, placeOrder, placeQuoteRequestOrder, removeFromWishlist,
  submitQuoteRequest, updateQuoteRequestItem,
} from './api';
import { addressPayload, EMPTY_ADDRESS } from './address';
import { stockedProduct } from './testSupport';
import { canAddItems, canCancel, displayStatus } from './quotes';

// Quote requests, referrals, notifications, saved searches and the wishlist against a REAL running backend and database.
const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp(): Promise<boolean> { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();

let counter = 0;
async function newBuyer(name = 'Stage Fourb', referralCode?: string) {
  const email = `stage4b-${Date.now()}-${++counter}@leap.dev`;
  const res = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'stage4b_password_123', name, ...(referralCode ? { referralCode } : {}) }) });
  expect(res.status).toBe(201);
  const { token, user } = await res.json();
  return { token: token as string, id: user.id as string, email };
}
const GENERATION = 'gen_bmw_1_series_f20';

describe.runIf(backendUp)('stage 4b: quote requests, referrals, notifications, saved searches and the wishlist against a REAL backend', () => {
  it('CRITICAL: the quote request lifecycle: a draft for a car, parts added and changed and removed, at most 20, nothing to send until there is a part, sent, then locked, then cancelled', async () => {
    const buyer = await newBuyer();
    const draft = await createQuoteRequest(buyer.token, GENERATION, 2017);
    expect(draft).toMatchObject({ status: 'draft', brand: 'BMW', year: 2017, items: [] });
    expect(canAddItems(draft)).toBe(true);
    await expect(submitQuoteRequest(buyer.token, draft.id)).rejects.toThrow(/at least one item/i);

    const first = await addQuoteRequestItem(buyer.token, draft.id, { name: 'Rear door handle', description: 'Left, black', quantity: 2 });
    expect(first.items[0]).toMatchObject({ name: 'Rear door handle', description: 'Left, black', quantity: 2, status: 'pending' });
    const itemId = first.items[0].id;
    const renamed = await updateQuoteRequestItem(buyer.token, draft.id, itemId, { name: 'Rear door handle (left)', quantity: 3 });
    expect(renamed.items[0]).toMatchObject({ name: 'Rear door handle (left)', quantity: 3 });
    await expect(addQuoteRequestItem(buyer.token, draft.id, { name: '   ' })).rejects.toThrow(/name is required/i);

    let latest = renamed;
    for (let i = 2; i <= 20; i++) latest = await addQuoteRequestItem(buyer.token, draft.id, { name: `Part ${i}` });
    expect(latest.items).toHaveLength(20);
    await expect(addQuoteRequestItem(buyer.token, draft.id, { name: 'One too many' })).rejects.toThrow(/at most 20 items/i);
    const less = await deleteQuoteRequestItem(buyer.token, draft.id, latest.items[19].id);
    expect(less.items).toHaveLength(19);

    const sent = await submitQuoteRequest(buyer.token, draft.id);
    expect(sent.status).toBe('submitted');
    expect(canAddItems(sent)).toBe(false);
    expect(canCancel(sent)).toBe(true);
    await expect(addQuoteRequestItem(buyer.token, draft.id, { name: 'Late part' })).rejects.toThrow(/only be added while the request is still a draft/i);
    await expect(submitQuoteRequest(buyer.token, draft.id)).rejects.toThrow(/Only a draft/i);

    const cancelled = await cancelQuoteRequest(buyer.token, draft.id);
    expect(cancelled.status).toBe('cancelled');
    expect(displayStatus(cancelled)).toBe('cancelled');
    await expect(cancelQuoteRequest(buyer.token, draft.id)).rejects.toThrow(/cancelled before it has been quoted/i);
  }, 120000);

  it('CRITICAL: a request is private to its buyer (another buyer gets "not found" for reading, changing, sending, cancelling), the list is only theirs, and a request that is not quoted cannot be ordered', async () => {
    const owner = await newBuyer(); const stranger = await newBuyer();
    const request = await createQuoteRequest(owner.token, GENERATION, 2018);
    await addQuoteRequestItem(owner.token, request.id, { name: 'Wing mirror' });
    await expect(fetchQuoteRequest(stranger.token, request.id)).rejects.toThrow(/not found/i);
    await expect(addQuoteRequestItem(stranger.token, request.id, { name: 'X' })).rejects.toThrow(/not found/i);
    await expect(submitQuoteRequest(stranger.token, request.id)).rejects.toThrow(/not found/i);
    await expect(cancelQuoteRequest(stranger.token, request.id)).rejects.toThrow(/not found/i);
    expect((await fetchMyQuoteRequests(stranger.token))).toEqual([]);
    expect((await fetchMyQuoteRequests(owner.token)).map((r) => r.id)).toEqual([request.id]);
    expect((await fetchQuoteRequest(owner.token, request.id)).items.map((i) => i.name)).toEqual(['Wing mirror']);
    await expect(placeQuoteRequestOrder(owner.token, request.id, `qr-cart-${Date.now()}`)).rejects.toThrow(/Only a quoted request can be ordered/i);
    await expect(createQuoteRequest(owner.token, 'gen_not_real', 2018)).rejects.toThrow(/Unknown generationId/i);
    await expect(fetchMyQuoteRequests('not-a-token')).rejects.toThrow();
  }, 90000);

  it('CRITICAL: referrals: a buyer who signs up with a friend\'s code shows in the friend\'s count and history (first name only, no reward before a first order)', async () => {
    const friend = await newBuyer('Layla Referrer');
    const info = await fetchMyReferral(friend.token);
    expect(info).toMatchObject({ totalReferred: 0, rewardsEarned: 0, capReached: false });
    expect(info.code).toMatch(/^REF-\d{6}$/);                                                                  // the shape the server makes (it has a hyphen)
    expect(info.maxRewards).toBeGreaterThan(0);
    expect(await fetchReferralHistory(friend.token)).toEqual([]);
    await newBuyer('Omar Joiner', info.code);
    const after = await fetchMyReferral(friend.token);
    expect(after.totalReferred).toBe(1);
    const history = await fetchReferralHistory(friend.token);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ firstName: 'Omar', rewardGranted: false });
    expect(typeof history[0].joinedAt).toBe('string');
    expect(Object.keys(history[0]).sort()).toEqual(['firstName', 'joinedAt', 'rewardGranted']);                  // nothing else about the person is sent
  }, 60000);

  it('saved searches: made, listed with their words, deleted by their owner only', async () => {
    const owner = await newBuyer(); const stranger = await newBuyer();
    const saved = await createSavedSearch(owner.token, { label: 'Brake discs', searchTerm: 'brake disc', category: 'brake' });
    expect(saved).toMatchObject({ label: 'Brake discs', searchTerm: 'brake disc', category: 'brake' });
    expect((await fetchSavedSearches(owner.token)).map((s) => s.id)).toEqual([saved.id]);
    expect(await fetchSavedSearches(stranger.token)).toEqual([]);
    await expect(deleteSavedSearch(stranger.token, saved.id)).rejects.toThrow();
    expect((await fetchSavedSearches(owner.token))).toHaveLength(1);
    await deleteSavedSearch(owner.token, saved.id);
    expect(await fetchSavedSearches(owner.token)).toEqual([]);
  }, 60000);

  it('the wishlist: a part is saved, listed, and removed', async () => {
    const buyer = await newBuyer();
    const product = await stockedProduct();
    await addToWishlist(buyer.token, product.id);
    expect((await fetchWishlist(buyer.token)).map((p) => p.id)).toEqual([product.id]);
    await removeFromWishlist(buyer.token, product.id);
    expect(await fetchWishlist(buyer.token)).toEqual([]);
  }, 60000);

  it('notifications: the list and the unread count agree, marking one or all read lowers the count, in either language, and another buyer\'s is out of reach', async () => {
    const buyer = await newBuyer();
    const product = await stockedProduct();
    const address = await createAddress(buyer.token, addressPayload({ ...EMPTY_ADDRESS, label: 'Home', recipientName: 'Notif Buyer', phone: '+968 1', country: 'Oman', city: 'Muscat', streetAddress: '1 Main St' }));
    await placeOrder([{ productId: product.id, quantity: 1 }], { userId: buyer.id }, { addressId: address.id });
    const list = await fetchNotifications(buyer.token);
    const unread = await fetchUnreadNotificationCount(buyer.token);
    expect(Array.isArray(list)).toBe(true);
    expect(unread).toBe(list.filter((n) => !n.isRead).length);
    expect((await fetchNotifications(buyer.token, 'ar')).length).toBe(list.length);                                // asking for Arabic returns the same notifications
    for (const n of list) expect(n).toMatchObject({ id: expect.any(Number), title: expect.any(String), body: expect.any(String), isRead: expect.any(Boolean) });
    if (list.length > 0) {
      const stranger = await newBuyer();
      await expect(markNotificationRead(stranger.token, list[0].id)).rejects.toThrow();                        // not theirs
      expect(await fetchUnreadNotificationCount(buyer.token)).toBe(unread);
      await markNotificationRead(buyer.token, list[0].id);
      expect(await fetchUnreadNotificationCount(buyer.token)).toBe(Math.max(unread - (list[0].isRead ? 0 : 1), 0));
    }
    await markAllNotificationsRead(buyer.token);
    expect(await fetchUnreadNotificationCount(buyer.token)).toBe(0);
  }, 90000);
});
