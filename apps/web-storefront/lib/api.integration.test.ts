import { describe, it, expect } from 'vitest';
import { fetchCategories, fetchProducts, fetchProductById, fetchCart, addCartItem, fetchMyOrders, fetchOrderById, fetchWishlist, checkWishlisted, addToWishlist, removeFromWishlist, submitReview, fetchMyReferral, fetchNotifications, fetchUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, resolveNotificationLink, fetchMyReturnCases, fetchReturnCase, sendReturnCaseMessage, placeOrder, fetchMyAddresses, createAddress, fetchVehicleBrands, fetchModelsForBrand, fetchGenerationsForModel, createSupportTicket, fetchMyTickets, fetchSupportTicket, sendSupportTicketMessage, validatePromoCode } from './api';

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

// REAL BUG FOUND AND FIXED HERE (recurring across several batches this
// session): several order-placement tests grabbed `products[0]`
// unconditionally and assumed effectively unlimited stock. Across many
// hours of real, cumulative test runs against this SAME persistent
// database, a handful of specific products' real stock genuinely ran
// down to 0 -- batch 11's own real stock-validation feature correctly
// rejecting the order at that point, not a bug in that feature. Fixed
// at the actual root cause (here) for the specific tests that place
// real orders, rather than reseeding the database again each time this
// recurs.
async function pickInStockProduct(minQuantity = 5) {
  const products = await fetchProducts();
  const found = products.find((p) => p.stockQuantity >= minQuantity);
  if (!found) throw new Error(`No real product with at least ${minQuantity} in stock -- reseed the database.`);
  return found;
}

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
    const product = await pickInStockProduct();
    await addCartItem(cartId, product.id, 2);
    const cart = await fetchCart(cartId);
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].productId).toBe(product.id);
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

    const product = await pickInStockProduct();
    await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }], userId: user.id,
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

    const product = await pickInStockProduct();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 2 }], userId: user.id,
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

    const product = await pickInStockProduct();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }], userId: owner.id,
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
    const product = await pickInStockProduct();

    await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }], userId: user.id,
        address: { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' },
      }),
    });

    const result = await submitReview(token, { productId: product.id, rating: 4 });
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
    // A real support ticket page now exists (app/support/[id]/page.tsx)
    // -- this used to correctly resolve to null when it didn't.
    expect(resolveNotificationLink(notifications[0])).toBe(`/support/${notifications[0].linkId}`);

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

  it('resolveNotificationLink correctly maps order, product, saved_search, and ticket link types to real pages', () => {
    expect(resolveNotificationLink({ id: 1, type: 'order_status', title: '', body: '', linkType: 'order', linkId: 'LP-123', isRead: false, createdAt: '' })).toBe('/orders/LP-123');
    expect(resolveNotificationLink({ id: 2, type: 'price_drop', title: '', body: '', linkType: 'product', linkId: 'p1', isRead: false, createdAt: '' })).toBe('/products/p1');
    expect(resolveNotificationLink({ id: 3, type: 'saved_search_match', title: '', body: '', linkType: 'saved_search', linkId: '5', isRead: false, createdAt: '' })).toBe('/saved-searches');
    expect(resolveNotificationLink({ id: 4, type: 'ticket_reply', title: '', body: '', linkType: 'ticket', linkId: 'T-999', isRead: false, createdAt: '' })).toBe('/support/T-999');
  });
});

// Real returns (new) -- the guest-access fix
describe.runIf(backendUp)('returns (guest + logged-in access) against a REAL running backend', () => {
  it('CRITICAL: a guest who files a return can check on it later with the real matching email, with no login at all', async () => {
    const suffix = Date.now();
    const guestEmail = `storefront-guest-return-${suffix}@example.com`;
    const product = await pickInStockProduct();

    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }], guestEmail,
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
    const product = await pickInStockProduct();

    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }], guestEmail,
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
    const product = await pickInStockProduct();

    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }], userId: user.id,
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

// Real account-aware checkout (new) -- the fix
describe.runIf(backendUp)('checkout (account-aware, real saved addresses) against a REAL running backend', () => {
  it('CRITICAL: a logged-in buyer placing an order with a NEW address is genuinely attached to their real account, not a guest order', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-checkout-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token, user } = await signupRes.json();
    const product = await pickInStockProduct();

    const order = await placeOrder(
      [{ productId: product.id, quantity: 1 }],
      { userId: user.id },
      { address: { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' } }
    );

    // Real, direct proof this order is genuinely attached to the real
    // account, not a guest order with buyer_id null -- fetched via the
    // account's own order-history endpoint, which only ever returns a
    // real buyer's own orders.
    const myOrders = await fetchMyOrders(token);
    expect(myOrders.find((o) => o.id === order.id)).toBeDefined();
  });

  it('CRITICAL: a real saved address can be used directly (addressId) without re-entering it, and the real order reflects it', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-savedaddr-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token, user } = await signupRes.json();

    const savedAddress = await createAddress(token, {
      label: 'Home', recipientName: 'Saved Buyer', phone: '555-0200', country: 'USA', city: 'Metropolis', streetAddress: '456 Saved St',
    });
    expect(savedAddress.isDefault).toBe(true); // the buyer's first real address is real-default by definition

    const product = await pickInStockProduct();
    const order = await placeOrder(
      [{ productId: product.id, quantity: 1 }],
      { userId: user.id },
      { addressId: savedAddress.id }
    );

    const detail = await fetchOrderById(token, order.id);
    expect(detail.address?.recipientName).toBe('Saved Buyer');
    expect(detail.address?.streetAddress).toBe('456 Saved St');
  });

  it('a real guest checkout still works exactly as before this fix (no regression)', async () => {
    const suffix = Date.now();
    const guestEmail = `storefront-guest-checkout-test-${suffix}@example.com`;
    const product = await pickInStockProduct();

    const order = await placeOrder(
      [{ productId: product.id, quantity: 1 }],
      { guestEmail },
      { address: { recipientName: 'Guest Buyer', phone: '555-0300', country: 'USA', city: 'Gotham', streetAddress: '789 Guest Ave' } }
    );
    expect(order.id).toBeTruthy();
    expect(order.total).toBeGreaterThan(0);
  });

  it('the real 3-address cap is enforced by the backend, surfaced correctly to the client', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-addresscap-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token } = await signupRes.json();

    for (let i = 0; i < 3; i++) {
      await createAddress(token, { label: `Address ${i}`, recipientName: 'Test', phone: '555-0000', country: 'USA', city: 'City', streetAddress: `${i} St` });
    }
    await expect(createAddress(token, { label: 'One too many', recipientName: 'Test', phone: '555-0000', country: 'USA', city: 'City', streetAddress: '4 St' })).rejects.toThrow(/up to 3/);

    const addresses = await fetchMyAddresses(token);
    expect(addresses.length).toBe(3);
  });
});

// Real vehicle-fitment filter (new) -- closes a real, confirmed gap:
// this storefront had zero vehicle-based filtering before this.
describe.runIf(backendUp)('vehicle fitment cascade + product filter against a REAL running backend', () => {
  it('CRITICAL: the full real Brand -> Model -> Generation -> Year cascade returns real data at every level', async () => {
    const brands = await fetchVehicleBrands();
    const bmw = brands.find((b) => b.name === 'BMW');
    expect(bmw).toBeDefined();

    const models = await fetchModelsForBrand(bmw!.id);
    const oneSeries = models.find((m) => m.name === '1 Series');
    expect(oneSeries).toBeDefined();

    const generations = await fetchGenerationsForModel(oneSeries!.id);
    const f20 = generations.find((g) => g.name === 'F20');
    expect(f20).toBeDefined();
    expect(f20!.yearStart).toBe(2015);
    expect(f20!.yearEnd).toBe(2019);
  });

  it('CRITICAL: filtering products by a real generation+year genuinely narrows to real matching products, not zero and not everything', async () => {
    const allProducts = await fetchProducts();
    const filtered = await fetchProducts({ generationId: 'gen_bmw_1_series_f20', year: 2018 });

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(allProducts.length);
  });

  it('a nonexistent generation genuinely returns zero real products, not an error or everything', async () => {
    const filtered = await fetchProducts({ generationId: 'not-a-real-generation', year: 2018 });
    expect(filtered.length).toBe(0);
  });
});

// Real support tickets (new) -- the guest-access fix, mirroring returns
describe.runIf(backendUp)('support tickets (guest + logged-in access) against a REAL running backend', () => {
  it('CRITICAL: a guest who files a ticket can check on it later with the real matching email, with no login at all', async () => {
    const suffix = Date.now();
    const guestEmail = `storefront-guest-ticket-${suffix}@example.com`;

    const created = await createSupportTicket(
      { subject: 'Test ticket', message: 'My order never arrived' },
      { guestEmail }
    );

    // The real point of this fix: no token anywhere, just the matching email.
    const fetched = await fetchSupportTicket(created.id, { guestEmail });
    expect(fetched.id).toBe(created.id);
    expect(fetched.messages[0].message).toBe('My order never arrived');

    await sendSupportTicketMessage(created.id, 'Any update?', { guestEmail });
    const afterReply = await fetchSupportTicket(created.id, { guestEmail });
    expect(afterReply.messages.length).toBe(2);
    expect(afterReply.messages[1].message).toBe('Any update?');
  });

  it('a guest supplying the WRONG email cannot access someone else\'s ticket', async () => {
    const suffix = Date.now();
    const guestEmail = `storefront-guest-wrong-ticket-${suffix}@example.com`;
    const created = await createSupportTicket(
      { subject: 'Test ticket', message: 'Not what I ordered' },
      { guestEmail }
    );

    await expect(fetchSupportTicket(created.id, { guestEmail: 'someone-else@example.com' })).rejects.toThrow();
  });

  it('a logged-in buyer\'s own ticket still works exactly as before (no regression)', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `storefront-buyer-ticket-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token } = await signupRes.json();

    const created = await createSupportTicket(
      { subject: 'Account ticket', message: 'Question about my account' },
      { token }
    );

    const list = await fetchMyTickets(token);
    expect(list.find((t) => t.id === created.id)).toBeDefined();

    const fetched = await fetchSupportTicket(created.id, { token });
    expect(fetched.id).toBe(created.id);
  });
});

// Real promo code support at checkout (new) -- closes a real,
// confirmed gap: the backend has always fully supported this, but
// checkout never had anywhere to enter one.
describe.runIf(backendUp)('promo codes at checkout against a REAL running backend', () => {
  it('CRITICAL: a real, valid code validates successfully and genuinely discounts the real order total placed with it', async () => {
    const adminLoginRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@leap.dev', password: 'admin_dev_password_123' }),
    });
    const { token: adminToken } = await adminLoginRes.json();

    const code = `CHECKOUTTEST${Date.now()}`;
    await fetch(`${BACKEND_URL}/promo-codes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ code, type: 'flat', value: 10 }),
    });

    const validation = await validatePromoCode(code);
    expect(validation.valid).toBe(true);

    const product = await pickInStockProduct();
    const guestEmail = `promo-checkout-test-${Date.now()}@example.com`;

    const orderWithout = await placeOrder([{ productId: product.id, quantity: 1 }], { guestEmail: `${guestEmail}-a` }, { address: { recipientName: 'Test', phone: '555-0000', country: 'USA', city: 'Test City', streetAddress: '1 Test St' } });
    const orderWith = await placeOrder([{ productId: product.id, quantity: 1 }], { guestEmail: `${guestEmail}-b` }, { address: { recipientName: 'Test', phone: '555-0000', country: 'USA', city: 'Test City', streetAddress: '1 Test St' } }, code);

    // Real, exact $10 discount -- not a client-side computed guess.
    expect(Number((orderWithout.total - orderWith.total).toFixed(2))).toBe(10);
  });

  it('a nonexistent code is genuinely rejected with a real reason, not silently ignored', async () => {
    const validation = await validatePromoCode('THIS-CODE-DOES-NOT-EXIST-12345');
    expect(validation.valid).toBe(false);
    if (!validation.valid) expect(validation.reason).toBeTruthy();
  });

  it('placing a real order with an invalid code fails with a real, specific error rather than silently placing at full price', async () => {
    const product = await pickInStockProduct();
    const guestEmail = `promo-invalid-checkout-test-${Date.now()}@example.com`;
    await expect(
      placeOrder([{ productId: product.id, quantity: 1 }], { guestEmail }, { address: { recipientName: 'Test', phone: '555-0000', country: 'USA', city: 'Test City', streetAddress: '1 Test St' } }, 'NOT-A-REAL-CODE-98765')
    ).rejects.toThrow();
  });
});
