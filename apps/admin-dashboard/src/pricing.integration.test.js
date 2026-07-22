import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for this one test's setup only — see below for why.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();
let pool;
if (backendUp) {
  pool = new Pool({ connectionString: TEST_DB_URL });
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
      // CONFIRMED (migration 037): a real product with no real stock
      // declared defaults to 0 and is genuinely unorderable now that
      // stock is actually enforced -- this test file places real
      // orders against its own test products, so it needs a real
      // stock quantity here, not the honest-but-zero default.
      stockQuantity: 100,
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

describe.runIf(backendUp)('pricing engine against a REAL running backend', () => {
  afterAll(async () => {
    if (pool) await pool.end();
  });
  it('CRITICAL: a supplier cannot submit a product priced in anything other than RMB', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nameZh: '货币测试', category: 'brake', part: 'Front Brake Disc', position: 'Front', oemNumber: `CUR-${Date.now()}`,
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
    // Reads the REAL stored price directly from the database rather than
    // hardcoding an assumed number — this dev database has been reused
    // across many earlier sessions, so p1's exact seeded value can
    // legitimately differ by environment/history. What actually matters,
    // and what this test verifies, is the INVARIANT: whatever p1's real
    // stored price and currency are, the buyer-facing API returns that
    // EXACT value completely unchanged, proving it was never run through
    // the RMB pricing equation (which would have silently produced
    // nonsense, e.g. treating $34.90 as if it were ¥34.90).
    const { rows } = await pool.query("SELECT price, currency_code FROM products WHERE id = 'p1'");
    const realPrice = Number(rows[0].price);
    const realCurrency = rows[0].currency_code;
    expect(realCurrency).not.toBe('CNY'); // confirms this is genuinely testing the legacy path, not accidentally a CNY product

    const res = await fetch(`${BACKEND_URL}/catalog/products/p1`);
    const product = await res.json();
    expect(product.currencyCode).toBe(realCurrency);
    expect(product.price).toBe(realPrice);
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

  // ---------------- Real fee component reordering (new) ----------------
  // Fee components apply "in order, top to bottom" against a running
  // total -- moving one changes the real calculation, not just display
  // order. Uses temporary test-only components (sort_order far outside
  // the real seeded range) so these tests never disturb the real
  // seeded pricing calculation other tests depend on.

  async function createTestFeeComponent(token, name, type, value, sortOrder) {
    const res = await fetch(`${BACKEND_URL}/pricing/fee-components`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, type, value, sortOrder }),
    });
    return res.json();
  }

  it('CRITICAL: moving a fee component up swaps its real sort_order with the real previous component, and back down restores it', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const a = await createTestFeeComponent(token, 'Test Fee A', 'flat', 1, 9001);
    const b = await createTestFeeComponent(token, 'Test Fee B', 'flat', 1, 9002);

    try {
      const upRes = await fetch(`${BACKEND_URL}/pricing/fee-components/${b.id}/move`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ direction: 'up' }),
      });
      expect(upRes.status).toBe(200);
      const afterUp = await upRes.json();
      expect(afterUp.find((c) => c.id === b.id).sortOrder).toBe(9001);
      expect(afterUp.find((c) => c.id === a.id).sortOrder).toBe(9002);

      const downRes = await fetch(`${BACKEND_URL}/pricing/fee-components/${b.id}/move`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ direction: 'down' }),
      });
      const afterDown = await downRes.json();
      expect(afterDown.find((c) => c.id === b.id).sortOrder).toBe(9002);
      expect(afterDown.find((c) => c.id === a.id).sortOrder).toBe(9001);
    } finally {
      await fetch(`${BACKEND_URL}/pricing/fee-components/${a.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetch(`${BACKEND_URL}/pricing/fee-components/${b.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    }
  });

  it('CRITICAL: reordering a real percentage fee relative to a real flat fee genuinely changes the calculated price, not just display order', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const flatFee = await createTestFeeComponent(token, 'Test Flat', 'flat', 50, 9001);
    const pctFee = await createTestFeeComponent(token, 'Test Percentage', 'percentage', 10, 9002);

    try {
      const before = await fetch(`${BACKEND_URL}/pricing/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ supplierCostCny: 400, weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 10 }),
      }).then((r) => r.json());

      await fetch(`${BACKEND_URL}/pricing/fee-components/${pctFee.id}/move`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ direction: 'up' }),
      });

      const after = await fetch(`${BACKEND_URL}/pricing/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ supplierCostCny: 400, weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 10 }),
      }).then((r) => r.json());

      // A real percentage fee computed BEFORE vs AFTER a real flat fee
      // is added produces a genuinely different real total -- this is
      // not a cosmetic reorder.
      expect(after.buyerPriceUsd).not.toBe(before.buyerPriceUsd);
    } finally {
      await fetch(`${BACKEND_URL}/pricing/fee-components/${flatFee.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetch(`${BACKEND_URL}/pricing/fee-components/${pctFee.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    }
  });

  it('the real first fee component cannot be moved up, and the real last one cannot be moved down', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { rows } = { rows: await fetch(`${BACKEND_URL}/pricing/fee-components`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()) };
    const sorted = rows.sort((a, b) => a.sortOrder - b.sortOrder);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const upRes = await fetch(`${BACKEND_URL}/pricing/fee-components/${first.id}/move`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ direction: 'up' }),
    });
    expect(upRes.status).toBe(400);

    const downRes = await fetch(`${BACKEND_URL}/pricing/fee-components/${last.id}/move`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ direction: 'down' }),
    });
    expect(downRes.status).toBe(400);
  });

  it('an invalid direction and a nonexistent component are both rejected', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const invalidDirRes = await fetch(`${BACKEND_URL}/pricing/fee-components/fee_bank/move`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ direction: 'sideways' }),
    });
    expect(invalidDirRes.status).toBe(400);

    const notFoundRes = await fetch(`${BACKEND_URL}/pricing/fee-components/not_a_real_fee/move`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ direction: 'up' }),
    });
    expect(notFoundRes.status).toBe(404);
  });

  it('non-admins cannot reorder fee components', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/pricing/fee-components/fee_bank/move`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ direction: 'up' }),
    });
    expect(res.status).toBe(403);
  });
});
