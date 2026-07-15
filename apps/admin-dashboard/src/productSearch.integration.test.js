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

// Creates a real, unique category_part first (admin action), then a real
// product submission using that exact real part name — `part` is now
// validated against category_parts (migration 015), so a test can't just
// invent an arbitrary unique string the way it used to. This mirrors the
// same self-contained pattern used elsewhere (e.g.
// fitmentAdmin.integration.test.js creating its own real generation) —
// genuinely exercises the real validation path end-to-end rather than
// working around it.
async function createRealPart(category, nameEn) {
  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/catalog/categories/${category}/parts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ nameEn }),
  });
}

async function createApprovedProduct({ part, oemNumber, category = 'brake' } = {}) {
  const suffix = Date.now() + Math.random();
  const partName = part || `SearchTestPart${suffix}`;
  await createRealPart(category, partName);

  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  const createRes = await fetch(`${BACKEND_URL}/supplier/me/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({
      nameZh: `搜索测试 ${suffix}`,
      category, part: partName, position: 'Front', oemNumber: oemNumber || `SEARCH-${suffix}`,
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
    const filterId = await createApprovedProduct({ part: `FilterOnly${uniqueSuffix}`, category: 'filters' });
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

  it('CRITICAL: the real exact part filter -- for "tap a Part, see exactly its products" -- is precise, unlike the fuzzy search', async () => {
    const uniqueSuffix = Date.now();
    const exactPartName = `ExactPartFilterTest${uniqueSuffix}`;
    const productId = await createApprovedProduct({ part: exactPartName, category: 'brake' });
    await approveProduct(productId, `${exactPartName} English`);

    const matchRes = await fetch(`${BACKEND_URL}/catalog/products?category=brake&part=${encodeURIComponent(exactPartName)}`);
    expect((await matchRes.json()).find((p) => p.id === productId)).toBeDefined();

    // A DIFFERENT real part in the same category must not match.
    const noMatchRes = await fetch(`${BACKEND_URL}/catalog/products?category=brake&part=${encodeURIComponent('Front Brake Disc')}`);
    expect((await noMatchRes.json()).find((p) => p.id === productId)).toBeUndefined();
  });

  it('CRITICAL: sort=newest returns products in real, genuine creation-time order, not incidental database order', async () => {
    const uniqueSuffix = Date.now();
    const olderId = await createApprovedProduct({ part: `SortTestOlder${uniqueSuffix}`, category: 'brake' });
    await approveProduct(olderId, `SortTestOlder${uniqueSuffix} English`);
    await new Promise((r) => setTimeout(r, 50)); // ensure a genuinely later real timestamp, not a coincidence
    const newerId = await createApprovedProduct({ part: `SortTestNewer${uniqueSuffix}`, category: 'brake' });
    await approveProduct(newerId, `SortTestNewer${uniqueSuffix} English`);

    const res = await fetch(`${BACKEND_URL}/catalog/products?category=brake&sort=newest`);
    const results = await res.json();
    const olderIndex = results.findIndex((p) => p.id === olderId);
    const newerIndex = results.findIndex((p) => p.id === newerId);
    expect(olderIndex).toBeGreaterThan(-1);
    expect(newerIndex).toBeGreaterThan(-1);
    expect(newerIndex).toBeLessThan(olderIndex); // the real newer product comes first
  });
});
