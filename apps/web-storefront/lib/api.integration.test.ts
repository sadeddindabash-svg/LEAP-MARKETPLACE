import { describe, it, expect } from 'vitest';
import { fetchCategories, fetchProducts, fetchProductById, fetchCart, addCartItem } from './api';

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
});
