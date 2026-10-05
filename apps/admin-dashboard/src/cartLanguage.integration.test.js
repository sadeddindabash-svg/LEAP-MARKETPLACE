import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
const ARABIC_NAME = 'قرص فرامل أمامي مهوّى مقاس ٣٠٠ مم للسيارات الأوروبية'; // within the real 25-100 character rule for Arabic names

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

const newCartId = () => `cart-lang-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function addToCart(cartId, productId, lang) {
  const qs = lang ? `?lang=${lang}` : '';
  return fetch(`${BACKEND_URL}/cart/${cartId}/items${qs}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity: 1 }),
  });
}

const getCart = (cartId, lang) =>
  fetch(`${BACKEND_URL}/cart/${cartId}${lang ? `?lang=${lang}` : ''}`).then((r) => r.json());

describe.runIf(backendUp)('cart item names follow the requested language (real backend)', () => {
  it('CRITICAL: a basket returns the approved Arabic name for lang=ar, and the English name for lang=en or no lang', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    // Give a real seeded product an approved Arabic name via the real admin route.
    const edit = await fetch(`${BACKEND_URL}/catalog/admin/products/p4`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nameAr: ARABIC_NAME }),
    });
    expect(edit.status).toBe(200);

    const cartId = newCartId();
    const added = await addToCart(cartId, 'p4'); // no lang -> default
    expect(added.status).toBe(201);
    const defaultName = (await added.json()).items[0].name;
    expect(defaultName).not.toBe(ARABIC_NAME);

    expect((await getCart(cartId, 'en')).items[0].name).toBe(defaultName);
    expect((await getCart(cartId)).items[0].name).toBe(defaultName);
    expect((await getCart(cartId, 'ar')).items[0].name).toBe(ARABIC_NAME);
  });

  it('every basket-changing call also honours lang=ar (add, change quantity), not just the read', async () => {
    const cartId = newCartId();
    const added = await addToCart(cartId, 'p4', 'ar');
    expect((await added.json()).items[0].name).toBe(ARABIC_NAME);

    const patched = await fetch(`${BACKEND_URL}/cart/${cartId}/items/p4?lang=ar`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 2 }),
    }).then((r) => r.json());
    expect(patched.items[0].name).toBe(ARABIC_NAME);
    expect(patched.items[0].quantity).toBe(2);
  });

  it('a product with NO Arabic name still shows its English name under lang=ar (never blank)', async () => {
    // A product whose name is identical under lang=ar and lang=en has no Arabic name.
    const en = await fetch(`${BACKEND_URL}/catalog/products?lang=en`).then((r) => r.json());
    const ar = await fetch(`${BACKEND_URL}/catalog/products?lang=ar`).then((r) => r.json());
    const arById = new Map(ar.map((p) => [p.id, p.name]));
    const candidates = en.filter((p) => p.id !== 'p4' && arById.get(p.id) === p.name);
    expect(candidates.length).toBeGreaterThan(0);

    let checked = false;
    for (const product of candidates) {
      const cartId = newCartId();
      const added = await addToCart(cartId, product.id, 'ar');
      if (added.status !== 201) continue; // e.g. out of stock -- try the next candidate
      const item = (await added.json()).items[0];
      expect(item.name).toBe(product.name);
      expect(item.name).toBeTruthy();
      checked = true;
      break;
    }
    expect(checked).toBe(true);
  });
});
