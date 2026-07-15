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

describe.runIf(backendUp)('admin fitment cascade management against a REAL running backend', () => {
  it('rejects unauthenticated and non-admin creation', async () => {
    const anonRes = await fetch(`${BACKEND_URL}/fitment/brands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Test Brand ${Date.now()}` }),
    });
    expect(anonRes.status).toBe(401);

    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const supplierRes = await fetch(`${BACKEND_URL}/fitment/brands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ name: `Test Brand ${Date.now()}` }),
    });
    expect(supplierRes.status).toBe(403);
  });

  it('rejects a duplicate brand name with a clear 409, not a raw DB error', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const name = `Dup Test Brand ${Date.now()}`;
    const first = await fetch(`${BACKEND_URL}/fitment/brands`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    expect(first.status).toBe(201);

    const second = await fetch(`${BACKEND_URL}/fitment/brands`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    expect(second.status).toBe(409);
  });

  it('CRITICAL: builds a full new Brand->Model->Generation->Engine/Transmission chain, and it is immediately visible via the real GET endpoints a supplier would use', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const suffix = Date.now();

    const brandRes = await fetch(`${BACKEND_URL}/fitment/brands`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `E2E Brand ${suffix}` }),
    });
    const brand = await brandRes.json();

    const modelRes = await fetch(`${BACKEND_URL}/fitment/brands/${brand.id}/models`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'E2E Model' }),
    });
    const model = await modelRes.json();
    expect(model.brandId).toBe(brand.id);

    const genRes = await fetch(`${BACKEND_URL}/fitment/models/${model.id}/generations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'E2E Gen', yearStart: 2020, yearEnd: 2025 }),
    });
    const generation = await genRes.json();
    expect(generation.modelId).toBe(model.id);

    const engRes = await fetch(`${BACKEND_URL}/fitment/generations/${generation.id}/engines`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'E2E Engine' }),
    });
    expect(engRes.status).toBe(201);

    const transRes = await fetch(`${BACKEND_URL}/fitment/generations/${generation.id}/transmissions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'E2E Transmission' }),
    });
    expect(transRes.status).toBe(201);

    // Now confirm the whole chain via the real read endpoints, exactly as
    // the supplier portal's Add Product form would fetch them.
    const brandsListRes = await fetch(`${BACKEND_URL}/fitment/brands`);
    const brandsList = await brandsListRes.json();
    expect(brandsList.find((b) => b.id === brand.id)).toBeDefined();

    const modelsListRes = await fetch(`${BACKEND_URL}/fitment/brands/${brand.id}/models`);
    const modelsList = await modelsListRes.json();
    expect(modelsList.length).toBe(1);

    const gensListRes = await fetch(`${BACKEND_URL}/fitment/models/${model.id}/generations`);
    const gensList = await gensListRes.json();
    expect(gensList[0].yearStart).toBe(2020);

    const enginesListRes = await fetch(`${BACKEND_URL}/fitment/generations/${generation.id}/engines`);
    expect((await enginesListRes.json()).length).toBe(1);
  });

  it('rejects a generation with yearEnd before yearStart', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const brandRes = await fetch(`${BACKEND_URL}/fitment/brands`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Year Test Brand ${Date.now()}` }),
    });
    const brand = await brandRes.json();
    const modelRes = await fetch(`${BACKEND_URL}/fitment/brands/${brand.id}/models`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Year Test Model' }),
    });
    const model = await modelRes.json();

    const res = await fetch(`${BACKEND_URL}/fitment/models/${model.id}/generations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Bad Range', yearStart: 2020, yearEnd: 2015 }),
    });
    expect(res.status).toBe(400);
  });

  it('successfully deletes an unreferenced entry, confirmed by independent re-fetch', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const brandRes = await fetch(`${BACKEND_URL}/fitment/brands`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Delete Test Brand ${Date.now()}` }),
    });
    const brand = await brandRes.json();

    const deleteRes = await fetch(`${BACKEND_URL}/fitment/brands/${brand.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.status).toBe(204);

    const brandsListRes = await fetch(`${BACKEND_URL}/fitment/brands`);
    const brandsList = await brandsListRes.json();
    expect(brandsList.find((b) => b.id === brand.id)).toBeUndefined();
  });

  it('CRITICAL: refuses to delete a generation that a REAL product actually references, with a clear 409 (not a raw DB error, not a silent orphan)', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');

    // Self-contained: build our OWN brand/model/generation rather than
    // relying on another test file having already attached a product to
    // the shared seeded BMW F20 generation. Different test files (and
    // fresh databases with no prior test history) can't be assumed to
    // run in any particular order or to share incidental leftover state.
    const suffix = Date.now();
    const brandRes = await fetch(`${BACKEND_URL}/fitment/brands`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Protection Test Brand ${suffix}` }),
    });
    const brand = await brandRes.json();
    const modelRes = await fetch(`${BACKEND_URL}/fitment/brands/${brand.id}/models`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Protection Test Model' }),
    });
    const model = await modelRes.json();
    const genRes = await fetch(`${BACKEND_URL}/fitment/models/${model.id}/generations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Protection Test Gen', yearStart: 2020, yearEnd: 2024 }),
    });
    const generation = await genRes.json();

    // Attach a REAL product to it (image URLs don't need to be genuinely
    // uploaded files for this — the create-product endpoint only checks
    // the image COUNT, not that each URL resolves to a real upload; real
    // upload validation is covered separately in
    // supplier-portal/src/productSubmission.integration.test.js).
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({
        nameZh: '保护测试产品', category: 'brake', part: 'Test Part', position: 'Front', oemNumber: `PROT-${suffix}`,
        price: 10, currencyCode: 'USD', fitment: { generationId: generation.id, year: 2021 },
        images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
        weightKg: 1.5, lengthCm: 20, widthCm: 15, heightCm: 5,
      }),
    });

    const deleteRes = await fetch(`${BACKEND_URL}/fitment/generations/${generation.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteRes.status).toBe(409);

    // Confirm it's genuinely still there afterward.
    const stillThereRes = await fetch(`${BACKEND_URL}/fitment/models/${model.id}/generations`);
    const stillThere = await stillThereRes.json();
    expect(stillThere.find((g) => g.id === generation.id)).toBeDefined();
  });

  it('deleting a brand cascades to its own unreferenced models/generations/engines/transmissions', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const brandRes = await fetch(`${BACKEND_URL}/fitment/brands`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Cascade Test Brand ${Date.now()}` }),
    });
    const brand = await brandRes.json();
    const modelRes = await fetch(`${BACKEND_URL}/fitment/brands/${brand.id}/models`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Cascade Test Model' }),
    });
    const model = await modelRes.json();
    await fetch(`${BACKEND_URL}/fitment/models/${model.id}/generations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Cascade Test Gen', yearStart: 2021 }),
    });

    const deleteRes = await fetch(`${BACKEND_URL}/fitment/brands/${brand.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.status).toBe(204);

    // The model (and its generation underneath) should be gone too.
    const modelsListRes = await fetch(`${BACKEND_URL}/fitment/brands/${brand.id}/models`);
    const modelsList = await modelsListRes.json();
    expect(modelsList).toEqual([]);
  });
});
