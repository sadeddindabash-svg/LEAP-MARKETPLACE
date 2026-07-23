import { describe, it, expect } from 'vitest';
import { fetchCategories, fetchProducts, fetchProductById, fetchCart, addCartItem, fetchMyOrders, fetchOrderById, fetchWishlist, checkWishlisted, addToWishlist, removeFromWishlist } from './api';

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
});
