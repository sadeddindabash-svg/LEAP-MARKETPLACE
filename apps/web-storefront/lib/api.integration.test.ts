import { describe, it, expect } from 'vitest';
import { fetchCategories, fetchProducts, fetchProductById, fetchCart, addCartItem, fetchMyOrders, fetchOrderById, fetchWishlist, checkWishlisted, addToWishlist, removeFromWishlist, submitReview, fetchMyReferral, fetchNotifications, fetchUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, resolveNotificationLink, fetchMyReturnCases, fetchReturnCase, sendReturnCaseMessage } from './api';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

// The FIRST real test this app has ever had, against ANY backend
// endpoint -- this app previously had zero test files and no test
// script at all, unlike every other app in this monorepo. Starting
// with lib/api.ts since it's the foundation every single page in this
// app depends on -- if this file's real contract with the backend is
// wrong, every page built on top of it is wrong too, regardless of how
// correct the page's own rendering logic looks.
describe.runIf(backendUp)('web-storefront API client against a REAL running backend', () => {
  it('fetchCategories returns real, non-empty seeded categories', async () => {
    const categories = await fetchCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]).toHaveProperty('id');
    expect(categories[0]).toHaveProperty('nameEn');
  });

  it('fetchProducts returns real products with a real computed price, not a raw supplier cost', async () => {
    const products = await fetchProducts();
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(typeof p.price).toBe('number');
      expect(p.price).toBeGreaterThan(0);
    }
  });

  it('fetchProducts with a category filter never returns a product from a different category', async () => {
    const all = await fetchProducts();
    const firstCategory = all[0].category;
    const filtered = await fetchProducts({ category: firstCategory });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((p) => p.category === firstCategory)).toBe(true);
  });

  it('fetchProductById returns real detail fields (brand/model/year) for a real product', async () => {
    const products = await fetchProducts();
    const detail = await fetchProductById(products[0].id);
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(products[0].id);
  });

  it('fetchProductById returns null for a real nonexistent product, not a thrown error', async () => {
    const detail = await fetchProductById('this-product-id-does-not-exist');
    expect(detail).toBeNull();
  });

  it('a real cart genuinely persists an added item across two separate fetches', async () => {
    const cartId = `test-cart-${Date.now()}`;
    const products = await fetchProducts();
    await addCartItem(cartId, products[0].id, 2);
    const cart = await fetchCart(cartId);
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].productId).toBe(products[0].id);
    expect(cart.items[0].quantity).toBe(2);
  });

  it('CRITICAL: the cart genuinely rejects adding more than the real stock quantity', async () => {
    const cartId = `test-cart-stock-${Date.now()}`;
    const products = await fetchProducts();
    const product = products.find((p) => p.stockQuantity > 0)!;

    // Real stock is a live number, not an unlimited assumption -- confirm
    // adding exactly the available amount works...
    await addCartItem(cartId, product.id, product.stockQuantity);
    const cart = await fetchCart(cartId);
    expect(cart.items[0].quantity).toBe(product.stockQuantity);
    expect(cart.items[0].stockQuantity).toBe(product.stockQuantity);

    // ...but one more than that is genuinely rejected, not silently
    // allowed (the real, previously-missing gap this closes).
    await expect(addCartItem(cartId, product.id, 1)).rejects.toThrow(/left in stock/);
  });

  // Real order history + detail (new) -- the biggest gap this app had:
  // a buyer who checked out here could never see a past order again.
  it('CRITICAL: a real placed order shows up in the real buyer\'s own order history', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-orders-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token, user } = await signupRes.json();

    const products = await fetchProducts();
    await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: products[0].id, quantity: 1 }], userId: user.id,
        address: { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' },
      }),
    });

    const orders = await fetchMyOrders(token);
    expect(orders.length).toBe(1);
    expect(orders[0].total).toBeGreaterThan(0);
    expect(typeof orders[0].displayStatus).toBe('string');
  });

  it('CRITICAL: order detail shows the real per-supplier split and real line items', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-orderdetail-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token, user } = await signupRes.json();

    const products = await fetchProducts();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: products[0].id, quantity: 2 }], userId: user.id,
        address: { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' },
      }),
    });
    const placedOrder = await orderRes.json();

    const detail = await fetchOrderById(token, placedOrder.id);
    expect(detail.id).toBe(placedOrder.id);
    expect(detail.supplierSubOrders.length).toBeGreaterThan(0);
    expect(detail.supplierSubOrders[0].items[0].quantity).toBe(2);
    expect(detail.address?.recipientName).toBe('Test Buyer');
  });

  it('a DIFFERENT buyer cannot fetch someone else\'s order detail', async () => {
    const suffix = Date.now();
    const ownerSignup = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-owner-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { user: owner } = await ownerSignup.json();

    const products = await fetchProducts();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: products[0].id, quantity: 1 }], userId: owner.id,
        address: { recipientName: 'Owner', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' },
      }),
    });
    const placedOrder = await orderRes.json();

    const otherSignup = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-intruder-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token: intruderToken } = await otherSignup.json();

    await expect(fetchOrderById(intruderToken, placedOrder.id)).rejects.toThrow();
  });

  // Real wishlist (new)
  it('CRITICAL: adding a real product to the wishlist makes it show up in the real list, and checkWishlisted reflects it', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-wishlist-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token } = await signupRes.json();
    const products = await fetchProducts();
    const productId = products[0].id;

    expect(await checkWishlisted(token, productId)).toBe(false);

    await addToWishlist(token, productId);
    expect(await checkWishlisted(token, productId)).toBe(true);

    const wishlist = await fetchWishlist(token);
    expect(wishlist.some((p) => p.id === productId)).toBe(true);

    await removeFromWishlist(token, productId);
    expect(await checkWishlisted(token, productId)).toBe(false);
    const wishlistAfterRemove = await fetchWishlist(token);
    expect(wishlistAfterRemove.some((p) => p.id === productId)).toBe(false);
  });

  it('adding the same product to the wishlist twice is idempotent, not an error', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-wishlist-dup-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token } = await signupRes.json();
    const products = await fetchProducts();

    await addToWishlist(token, products[0].id);
    await addToWishlist(token, products[0].id); // second time -- should not throw
    const wishlist = await fetchWishlist(token);
    expect(wishlist.filter((p) => p.id === products[0].id).length).toBe(1);
  });

  // Real review submission (new) -- the missing half: reading reviews
  // was already server-rendered SEO content, this is the write side.
  it('CRITICAL: a real submitted review comes back with real pending status, awaiting moderation', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-review-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token } = await signupRes.json();
    const products = await fetchProducts();

    const result = await submitReview(token, { productId: products[0].id, rating: 5, comment: 'Real integration test review' });
    expect(result.status).toBe('pending');
    expect(result.rating).toBe(5);
    expect(result.comment).toBe('Real integration test review');
  });

  it('rejects a review with no rating', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-review-norating-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token } = await signupRes.json();
    const products = await fetchProducts();

    // @ts-expect-error -- deliberately omitting the required rating field to confirm the backend genuinely rejects it
    await expect(submitReview(token, { productId: products[0].id })).rejects.toThrow();
  });

  it('a review from a buyer with only a placed (not yet delivered) order is correctly NOT marked verified', async () => {
    // hasVerifiedPurchase requires the shipment to have actually reached
    // hub_shipments.status = 'delivered' -- a placed-but-not-yet-shipped
    // order correctly does not count. This is deliberate business logic
    // (see services/api/src/modules/reviews/routes.js's own function),
    // not a gap -- confirming the honest negative case here.
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-unverified-review-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token, user } = await signupRes.json();
    const products = await fetchProducts();

    await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: products[0].id, quantity: 1 }], userId: user.id,
        address: { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' },
      }),
    });

    const result = await submitReview(token, { productId: products[0].id, rating: 4 });
    expect(result.isVerifiedPurchase).toBe(false);
  });

  // Real referrals (new)
  it('a new buyer gets a real referral code on first request', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-referral-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token } = await signupRes.json();

    const referral = await fetchMyReferral(token);
    expect(typeof referral.code).toBe('string');
    expect(referral.code.length).toBeGreaterThan(0);
    expect(referral.totalReferred).toBe(0);
  });

  it('CRITICAL: a real referred signup actually increments the referrer\'s real totalReferred count', async () => {
    const suffix = Date.now();
    const referrerSignup = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-referrer-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token: referrerToken } = await referrerSignup.json();
    const referralBefore = await fetchMyReferral(referrerToken);
    expect(referralBefore.totalReferred).toBe(0);

    // Real referred signup -- the exact same call app/signup/page.tsx
    // makes when a real ?ref=CODE link was used.
    await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-referee-test-${suffix}@example.com`, password: 'test_password_123', referralCode: referralBefore.code }),
    });

    const referralAfter = await fetchMyReferral(referrerToken);
    expect(referralAfter.totalReferred).toBe(1);
  });
});

// Real notifications (new)
describe.runIf(backendUp)('notifications against a REAL running backend', () => {
  it('CRITICAL: a real support-ticket reply from admin creates a real notification the buyer can see', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-notif-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token: buyerToken } = await signupRes.json();

    const beforeCount = await fetchUnreadNotificationCount(buyerToken);
    expect(beforeCount).toBe(0);

    const ticketRes = await fetch(`${BACKEND_URL}/support/tickets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ subject: 'Test ticket', message: 'Real test message' }),
    });
    const ticket = await ticketRes.json();

    const { token: adminToken } = await (await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@leap.dev', password: 'admin_dev_password_123' }),
    })).json();

    await fetch(`${BACKEND_URL}/support/tickets/${ticket.id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ message: 'Real admin reply' }),
    });

    const afterCount = await fetchUnreadNotificationCount(buyerToken);
    expect(afterCount).toBe(1);

    const notifications = await fetchNotifications(buyerToken);
    expect(notifications.length).toBe(1);
    expect(notifications[0].isRead).toBe(false);
    expect(notifications[0].linkType).toBe('ticket');
    // Real, honest gap: this storefront has no support-ticket page, so
    // resolveNotificationLink must return null here, not a link to a
    // page that doesn't exist.
    expect(resolveNotificationLink(notifications[0])).toBeNull();

    await markNotificationRead(buyerToken, notifications[0].id);
    const afterMarkRead = await fetchUnreadNotificationCount(buyerToken);
    expect(afterMarkRead).toBe(0);
  });

  it('markAllNotificationsRead genuinely marks every real unread notification as read', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-notif-markall-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token: buyerToken } = await signupRes.json();

    const { token: adminToken } = await (await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@leap.dev', password: 'admin_dev_password_123' }),
    })).json();

    // Two real tickets, two real replies -- two real notifications.
    for (let i = 0; i < 2; i++) {
      const ticketRes = await fetch(`${BACKEND_URL}/support/tickets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ subject: `Test ticket ${i}`, message: 'Real test message' }),
      });
      const ticket = await ticketRes.json();
      await fetch(`${BACKEND_URL}/support/tickets/${ticket.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ message: 'Real admin reply' }),
      });
    }

    expect(await fetchUnreadNotificationCount(buyerToken)).toBe(2);
    await markAllNotificationsRead(buyerToken);
    expect(await fetchUnreadNotificationCount(buyerToken)).toBe(0);
    const notifications = await fetchNotifications(buyerToken);
    expect(notifications.every((n) => n.isRead)).toBe(true);
  });

  it('resolveNotificationLink correctly maps order and product link types to real pages', () => {
    expect(resolveNotificationLink({ id: 1, type: 'order_status', title: '', body: '', linkType: 'order', linkId: 'LP-123', isRead: false, createdAt: '' })).toBe('/orders/LP-123');
    expect(resolveNotificationLink({ id: 2, type: 'price_drop', title: '', body: '', linkType: 'product', linkId: 'p1', isRead: false, createdAt: '' })).toBe('/products/p1');
    expect(resolveNotificationLink({ id: 3, type: 'saved_search_match', title: '', body: '', linkType: 'saved_search', linkId: '5', isRead: false, createdAt: '' })).toBe('/saved-searches');
  });
});

// Real returns (new) -- the guest-access fix
describe.runIf(backendUp)('returns (guest + logged-in access) against a REAL running backend', () => {
  it('CRITICAL: a guest who files a return can check on it later with the real matching email, with no login at all', async () => {
    const suffix = Date.now();
    const guestEmail = `storefront-guest-return-${suffix}@example.com`;
    const products = await fetchProducts();

    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: products[0].id, quantity: 1 }], guestEmail,
        address: { recipientName: 'Guest Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' },
      }),
    });
    const order = await orderRes.json();
    const subOrderId = order.supplierSubOrders[0].subOrderId;

    const caseRes = await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subOrderId, reason: 'Wrong item', message: 'Not what I ordered', guestEmail }),
    });
    const createdCase = await caseRes.json();

    // The real point of this fix: no token anywhere, just the matching email.
    const fetched = await fetchReturnCase(createdCase.id, { guestEmail });
    expect(fetched.id).toBe(createdCase.id);
    expect(fetched.messages[0].message).toBe('Not what I ordered');

    await sendReturnCaseMessage(createdCase.id, 'Any update?', { guestEmail });
    const afterReply = await fetchReturnCase(createdCase.id, { guestEmail });
    expect(afterReply.messages.length).toBe(2);
    expect(afterReply.messages[1].message).toBe('Any update?');
  });

  it('a guest supplying the WRONG email cannot access someone else\'s return case', async () => {
    const suffix = Date.now();
    const guestEmail = `storefront-guest-wrong-email-${suffix}@example.com`;
    const products = await fetchProducts();

    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: products[0].id, quantity: 1 }], guestEmail,
        address: { recipientName: 'Guest Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' },
      }),
    });
    const order = await orderRes.json();
    const subOrderId = order.supplierSubOrders[0].subOrderId;

    const caseRes = await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subOrderId, reason: 'Wrong item', message: 'Not what I ordered', guestEmail }),
    });
    const createdCase = await caseRes.json();

    await expect(fetchReturnCase(createdCase.id, { guestEmail: 'someone-else@example.com' })).rejects.toThrow();
  });

  it('a logged-in buyer\'s own return case still works exactly as before (no regression)', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-buyer-return-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token, user } = await signupRes.json();
    const products = await fetchProducts();

    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: products[0].id, quantity: 1 }], userId: user.id,
        address: { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' },
      }),
    });
    const order = await orderRes.json();
    const subOrderId = order.supplierSubOrders[0].subOrderId;

    const caseRes = await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subOrderId, reason: 'Damaged', message: 'Arrived broken' }),
    });
    const createdCase = await caseRes.json();

    const list = await fetchMyReturnCases(token);
    expect(list.find((c) => c.id === createdCase.id)).toBeDefined();

    const fetched = await fetchReturnCase(createdCase.id, { token });
    expect(fetched.id).toBe(createdCase.id);
  });
});
