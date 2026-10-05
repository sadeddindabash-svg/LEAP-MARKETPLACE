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

async function addToCart(cartId, productId, lang, quantity = 1) {
  const qs = lang ? `?lang=${lang}` : '';
  return fetch(`${BACKEND_URL}/cart/${cartId}/items${qs}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity }),
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

// ---------------------------------------------------------------------------
// Stock-shortfall errors carry a stable code + the numbers, so the mobile app can show
// its own Arabic sentence instead of the backend's English one.
// ---------------------------------------------------------------------------
describe.runIf(backendUp)('stock shortfall errors are machine-readable and language-aware (real backend)', () => {
  const WAY_MORE_THAN_EXISTS = 50_000_000;

  async function ensureArabicName() {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/catalog/admin/products/p4`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nameAr: ARABIC_NAME }),
    });
    expect(res.status).toBe(200);
  }

  it('CRITICAL: adding too many to the basket returns code + available + product name, and keeps the English message', async () => {
    await ensureArabicName();
    const res = await addToCart(newCartId(), 'p4', undefined, WAY_MORE_THAN_EXISTS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('insufficient_stock');
    expect(typeof body.available).toBe('number');
    expect(body.error).toBe(`Only ${body.available} of "${body.productName}" left in stock`); // English text unchanged
    expect(body.productName).not.toBe(ARABIC_NAME);
  });

  it('with lang=ar the product is named in Arabic, on BOTH basket paths (add and change quantity)', async () => {
    await ensureArabicName();
    const added = await (await addToCart(newCartId(), 'p4', 'ar', WAY_MORE_THAN_EXISTS)).json();
    expect(added.code).toBe('insufficient_stock');
    expect(added.productName).toBe(ARABIC_NAME);

    const cartId = newCartId();
    expect((await addToCart(cartId, 'p4', 'ar')).status).toBe(201);
    const patched = await fetch(`${BACKEND_URL}/cart/${cartId}/items/p4?lang=ar`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: WAY_MORE_THAN_EXISTS }),
    });
    expect(patched.status).toBe(400);
    const body = await patched.json();
    expect(body.code).toBe('insufficient_stock');
    expect(body.productName).toBe(ARABIC_NAME);
  });

  it('CRITICAL: placing an order for too many returns the same code + numbers, named in the requested language', async () => {
    await ensureArabicName();
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `stock-code-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: 'test_password_123' }),
    }).then((r) => r.json());
    const order = (lang) => fetch(`${BACKEND_URL}/order${lang ? `?lang=${lang}` : ''}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'p4', quantity: WAY_MORE_THAN_EXISTS }], userId: buyer.user.id,
        address: { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' },
      }),
    });

    const en = await order();
    expect(en.status).toBe(400);
    const enBody = await en.json();
    expect(enBody.code).toBe('insufficient_stock');
    expect(typeof enBody.available).toBe('number');
    expect(enBody.error).toContain('reduce the quantity and try again'); // original English text unchanged
    expect(enBody.productName).not.toBe(ARABIC_NAME);

    expect((await (await order('ar')).json()).productName).toBe(ARABIC_NAME);
  });

  it('an unrelated basket error has no code (nothing else changed shape)', async () => {
    const res = await addToCart(newCartId(), 'definitely-not-a-product');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Product not found');
    expect(body.code).toBeUndefined();
  });
});
