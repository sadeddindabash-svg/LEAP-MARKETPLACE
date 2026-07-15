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

async function createApprovedCnyProduct({ priceCny, weightKg, lengthCm, widthCm, heightCm }) {
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  const suffix = Date.now() + Math.random();
  const createRes = await fetch(`${BACKEND_URL}/supplier/me/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({
      nameZh: `定价引擎测试 ${suffix}`,
      category: 'brake', part: 'Front Brake Disc', position: 'Front', oemNumber: `PRICING-${suffix}`,
      price: priceCny, currencyCode: 'CNY',
      fitment: { generationId: 'gen_bmw_1_series_f20', year: 2018 },
      images: ['/uploads/p-a.jpg', '/uploads/p-b.jpg', '/uploads/p-c.jpg'],
      weightKg, lengthCm, widthCm, heightCm,
    }),
  });
  const created = await createRes.json();

  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/catalog/products/${created.id}/moderate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'approve', nameEn: 'Pricing Engine Test Product', nameAr: 'اختبار محرك التسعير' }),
  });
  return created.id;
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('pricing engine against a REAL running backend', () => {
  it('CRITICAL: a supplier cannot submit a product priced in anything other than RMB', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nameZh: '货币测试', category: 'brake', part: 'x', position: 'Front', oemNumber: `CUR-${Date.now()}`,
        price: 100, currencyCode: 'USD',
        fitment: { generationId: 'gen_bmw_1_series_f20', year: 2018 },
        images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
        weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('CNY');
  });

  it('rejects unauthenticated and non-admin access to fee-component and FX-rate management', async () => {
    const anonRes = await fetch(`${BACKEND_URL}/pricing/fee-components`);
    expect(anonRes.status).toBe(401);

    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const supplierRes = await fetch(`${BACKEND_URL}/pricing/fee-components`, { headers: { Authorization: `Bearer ${supplierToken}` } });
    expect(supplierRes.status).toBe(403);
  });

  it('CRITICAL: the pricing preview endpoint computes a real, independently-verifiable result', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/pricing/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ supplierCostCny: 100, weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10 }),
    });
    expect(res.status).toBe(200);
    const result = await res.json();
    // Independently re-derive the expected landed cost from the same
    // real fee components this test doesn't control, to prove the
    // engine's math is genuinely correct, not just "returns some number".
    const feesRes = await fetch(`${BACKEND_URL}/pricing/fee-components`, { headers: { Authorization: `Bearer ${token}` } });
    const fees = (await feesRes.json()).filter((f) => f.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    let expectedTotal = 100;
    for (const f of fees) {
      if (f.type === 'percentage') expectedTotal += expectedTotal * (f.value / 100);
      else if (f.type === 'flat') expectedTotal += f.value;
      else if (f.type === 'shipping_volumetric') {
        const chargeable = Math.max(2, (30 * 20 * 10) / 5000);
        expectedTotal += f.value * chargeable;
      }
    }
    expect(result.landedCostCny).toBeCloseTo(expectedTotal, 2);
    expect(result.buyerPriceUsd).toBeCloseTo(expectedTotal * result.fxRate, 2);
  });

  it('rejects a negative/zero cost, and a shipping fee cannot be applied without real dimensions', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const negRes = await fetch(`${BACKEND_URL}/pricing/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ supplierCostCny: -5, weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1 }),
    });
    expect(negRes.status).toBe(400);

    const missingDimsRes = await fetch(`${BACKEND_URL}/pricing/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ supplierCostCny: 100 }),
    });
    expect(missingDimsRes.status).toBe(400);
  });

  it('a real fee component can be created, updated, and deleted, and an invalid type is rejected', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const createRes = await fetch(`${BACKEND_URL}/pricing/fee-components`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Test Fee Component', type: 'flat', value: 5, sortOrder: 500 }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const updateRes = await fetch(`${BACKEND_URL}/pricing/fee-components/${created.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: 10 }),
    });
    expect((await updateRes.json()).value).toBe(10);

    const invalidRes = await fetch(`${BACKEND_URL}/pricing/fee-components`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Bad', type: 'nonsense', value: 1 }),
    });
    expect(invalidRes.status).toBe(400);

    const deleteRes = await fetch(`${BACKEND_URL}/pricing/fee-components/${created.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.status).toBe(204);
  });

  it('CRITICAL: a real RMB-priced product shows a computed USD price to buyers, and it changes live when a fee changes', async () => {
    const productId = await createApprovedCnyProduct({ priceCny: 150, weightKg: 2, lengthCm: 25, widthCm: 25, heightCm: 5 });

    const before = await (await fetch(`${BACKEND_URL}/catalog/products/${productId}`)).json();
    expect(before.currencyCode).toBe('USD');
    expect(before.price).toBeGreaterThan(0);

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const feesRes = await fetch(`${BACKEND_URL}/pricing/fee-components`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const leapFee = (await feesRes.json()).find((f) => f.id === 'fee_leap');
    const originalValue = leapFee.value;

    await fetch(`${BACKEND_URL}/pricing/fee-components/fee_leap`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ value: originalValue + 20 }),
    });

    const after = await (await fetch(`${BACKEND_URL}/catalog/products/${productId}`)).json();
    expect(after.price).toBeGreaterThan(before.price);

    // Restore, so this test doesn't affect any other test's expectations.
    await fetch(`${BACKEND_URL}/pricing/fee-components/fee_leap`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ value: originalValue }),
    });
  });

  it('CRITICAL: a placed order locks in the price at that exact moment -- later fee changes do not affect it, even though browsing the same product shows the new price', async () => {
    const productId = await createApprovedCnyProduct({ priceCny: 80, weightKg: 1.5, lengthCm: 20, widthCm: 20, heightCm: 4 });
    const priceAtBrowseTime = (await (await fetch(`${BACKEND_URL}/catalog/products/${productId}`)).json()).price;

    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId, quantity: 1 }], guestEmail: `pricing-lock-${Date.now()}@example.com` }),
    });
    const order = await orderRes.json();
    expect(order.total).toBeCloseTo(priceAtBrowseTime, 2);

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await fetch(`${BACKEND_URL}/pricing/fee-components/fee_leap`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ value: 999 }), // a deliberately huge change to make any leak obvious
    });

    const orderDetail = await (await fetch(`${BACKEND_URL}/order/${order.id}`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
    expect(orderDetail.total).toBeCloseTo(priceAtBrowseTime, 2);
    expect(orderDetail.supplierSubOrders[0].items[0].unitPrice).toBeCloseTo(priceAtBrowseTime, 2);

    const priceAfterFeeChange = (await (await fetch(`${BACKEND_URL}/catalog/products/${productId}`)).json()).price;
    expect(priceAfterFeeChange).not.toBeCloseTo(priceAtBrowseTime, 1);

    // Restore.
    await fetch(`${BACKEND_URL}/pricing/fee-components/fee_leap`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ value: 15 }),
    });
  });

  it('a legacy product priced before this feature existed (not CNY) passes through unaffected by the pricing engine', async () => {
    // p1 is real seed data, priced in USD, predating this feature.
    const res = await fetch(`${BACKEND_URL}/catalog/products/p1`);
    const product = await res.json();
    expect(product.currencyCode).toBe('USD');
    expect(product.price).toBe(34.9);
  });

  it('the admin can view and update the real FX rate', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const getRes = await fetch(`${BACKEND_URL}/pricing/fx-rate`, { headers: { Authorization: `Bearer ${token}` } });
    expect(getRes.status).toBe(200);
    const original = await getRes.json();

    const updateRes = await fetch(`${BACKEND_URL}/pricing/fx-rate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pair: 'CNY_USD', rate: 0.15 }),
    });
    expect(updateRes.status).toBe(200);
    expect((await updateRes.json()).rate).toBe(0.15);

    // Restore.
    await fetch(`${BACKEND_URL}/pricing/fx-rate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pair: 'CNY_USD', rate: original.rate }),
    });
  });
});
