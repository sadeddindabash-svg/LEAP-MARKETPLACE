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

async function createApprovedProduct({ part, oemNumber, category = 'brake' } = {}) {
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  const suffix = Date.now() + Math.random();
  const createRes = await fetch(`${BACKEND_URL}/supplier/me/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({
      nameZh: `搜索测试 ${suffix}`,
      category, part: part || `SearchTestPart${suffix}`, position: 'Front', oemNumber: oemNumber || `SEARCH-${suffix}`,
      price: 88, currencyCode: 'CNY',
      fitment: { generationId: 'gen_bmw_1_series_f20', year: 2019 },
      images: ['/uploads/s-a.jpg', '/uploads/s-b.jpg', '/uploads/s-c.jpg'],
      weightKg: 2, lengthCm: 20, widthCm: 20, heightCm: 5,
    }),
  });
  const created = await createRes.json();
  return created.id;
}

async function approveProduct(productId, nameEn) {
  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/catalog/products/${productId}/moderate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'approve', nameEn, nameAr: 'اختبار البحث' }),
  });
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('product search against a REAL running backend', () => {
  it('CRITICAL: an approved product genuinely does not appear in search results BEFORE approval, and DOES appear immediately after', async () => {
    const uniquePart = `UniqueSearchablePart${Date.now()}`;
    const productId = await createApprovedProduct({ part: uniquePart });

    const beforeRes = await fetch(`${BACKEND_URL}/catalog/products?search=${uniquePart}`);
    const before = await beforeRes.json();
    expect(before.find((p) => p.id === productId)).toBeUndefined();

    await approveProduct(productId, `${uniquePart} (English)`);

    const afterRes = await fetch(`${BACKEND_URL}/catalog/products?search=${uniquePart}`);
    const after = await afterRes.json();
    expect(after.find((p) => p.id === productId)).toBeDefined();
  });

  it('CRITICAL: search is precise -- searching for one category does not return an unrelated one', async () => {
    const uniqueSuffix = Date.now();
    const brakeId = await createApprovedProduct({ part: `BrakeOnly${uniqueSuffix}`, category: 'brake' });
    const filterId = await createApprovedProduct({ part: `FilterOnly${uniqueSuffix}`, category: 'filter' });
    await approveProduct(brakeId, `BrakeOnly${uniqueSuffix} English`);
    await approveProduct(filterId, `FilterOnly${uniqueSuffix} English`);

    const res = await fetch(`${BACKEND_URL}/catalog/products?search=BrakeOnly${uniqueSuffix}`);
    const results = await res.json();
    expect(results.find((p) => p.id === brakeId)).toBeDefined();
    expect(results.find((p) => p.id === filterId)).toBeUndefined();
  });

  it('CRITICAL: a real multi-word search requires every word to match somewhere -- "bmw" plus the part name together, not either alone anywhere', async () => {
    const uniquePart = `MultiWordTest${Date.now()}`;
    const productId = await createApprovedProduct({ part: uniquePart });
    await approveProduct(productId, `${uniquePart} English`);

    // This product's real fitment is BMW (see createApprovedProduct's
    // fixed generationId) -- "bmw" + the part name together should match.
    const matchRes = await fetch(`${BACKEND_URL}/catalog/products?search=bmw+${uniquePart}`);
    const matches = await matchRes.json();
    expect(matches.find((p) => p.id === productId)).toBeDefined();

    // A real, different brand name should NOT match this BMW-fitment product.
    const noMatchRes = await fetch(`${BACKEND_URL}/catalog/products?search=toyota+${uniquePart}`);
    const noMatches = await noMatchRes.json();
    expect(noMatches.find((p) => p.id === productId)).toBeUndefined();
  });

  it('matches on OEM number directly', async () => {
    const uniqueOem = `OEMSEARCH${Date.now()}`;
    const productId = await createApprovedProduct({ oemNumber: uniqueOem });
    await approveProduct(productId, 'OEM Search Test English');

    const res = await fetch(`${BACKEND_URL}/catalog/products?search=${uniqueOem}`);
    const results = await res.json();
    expect(results.find((p) => p.id === productId)).toBeDefined();
  });

  it('a nonsense search term returns real zero results, not an error', async () => {
    const res = await fetch(`${BACKEND_URL}/catalog/products?search=zzzznonexistentsearchtermxyz`);
    expect(res.status).toBe(200);
    const results = await res.json();
    expect(results).toEqual([]);
  });

  it('search combines correctly with an existing category filter', async () => {
    const uniquePart = `CombinedFilterTest${Date.now()}`;
    const productId = await createApprovedProduct({ part: uniquePart, category: 'brake' });
    await approveProduct(productId, `${uniquePart} English`);

    const matchRes = await fetch(`${BACKEND_URL}/catalog/products?category=brake&search=${uniquePart}`);
    expect((await matchRes.json()).find((p) => p.id === productId)).toBeDefined();

    const noMatchRes = await fetch(`${BACKEND_URL}/catalog/products?category=filter&search=${uniquePart}`);
    expect((await noMatchRes.json()).find((p) => p.id === productId)).toBeUndefined();
  });
});
