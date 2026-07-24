// @vitest-environment node
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

// Real back-in-stock alerts (new) -- closes a real, confirmed gap:
// nothing notified a buyer when a wishlisted, out-of-stock product
// came back. Deliberately NOT a periodic sweep like price-drop alerts
// need -- stock only ever changes at one real, controllable point (a
// supplier's own PATCH /supplier/me/products/:id), so this hooks in
// directly there.
describe.runIf(backendUp)('back-in-stock alerts against a REAL running backend', () => {
  it('CRITICAL: a genuine 0 -> positive stock transition notifies every real buyer with this product wishlisted', async () => {
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const products = await fetch(`${BACKEND_URL}/supplier/me/products`, { headers: { Authorization: `Bearer ${supplierToken}` } }).then((r) => r.json());
    const product = products[0];

    // Real, clean starting state -- explicitly zero before wishlisting,
    // so the buyer's wishlist add itself can never be misread as the
    // trigger.
    await fetch(`${BACKEND_URL}/supplier/me/products/${product.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ stockQuantity: 0 }),
    });

    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `restock-alert-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token: buyerToken } = await signupRes.json();

    await fetch(`${BACKEND_URL}/wishlist/me/${product.id}`, { method: 'POST', headers: { Authorization: `Bearer ${buyerToken}` } });

    const beforeNotifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${buyerToken}` } }).then((r) => r.json());
    expect(beforeNotifications.length).toBe(0);

    // The real restock -- a genuine 0 -> positive transition.
    await fetch(`${BACKEND_URL}/supplier/me/products/${product.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ stockQuantity: 25 }),
    });

    // Real, brief wait -- the notification fires via a real, best-effort
    // async call that deliberately doesn't block the PATCH response
    // itself (a notification failure should never fail a real product
    // update).
    await new Promise((r) => setTimeout(r, 500));

    const afterNotifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${buyerToken}` } }).then((r) => r.json());
    expect(afterNotifications.length).toBe(1);
    expect(afterNotifications[0].type).toBe('back_in_stock');
    expect(afterNotifications[0].body).toContain(product.name);
  });

  it('raising stock that was already positive does NOT create a duplicate notification', async () => {
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const products = await fetch(`${BACKEND_URL}/supplier/me/products`, { headers: { Authorization: `Bearer ${supplierToken}` } }).then((r) => r.json());
    const product = products[1];

    await fetch(`${BACKEND_URL}/supplier/me/products/${product.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ stockQuantity: 0 }),
    });

    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `restock-no-dup-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token: buyerToken } = await signupRes.json();
    await fetch(`${BACKEND_URL}/wishlist/me/${product.id}`, { method: 'POST', headers: { Authorization: `Bearer ${buyerToken}` } });

    // Real restock (0 -> 10), then a real further raise (10 -> 40) --
    // only the first is a genuine "back in stock" from a buyer's
    // perspective.
    await fetch(`${BACKEND_URL}/supplier/me/products/${product.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ stockQuantity: 10 }),
    });
    await new Promise((r) => setTimeout(r, 500));
    await fetch(`${BACKEND_URL}/supplier/me/products/${product.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ stockQuantity: 40 }),
    });
    await new Promise((r) => setTimeout(r, 500));

    const notifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${buyerToken}` } }).then((r) => r.json());
    expect(notifications.length).toBe(1);
  });
});
