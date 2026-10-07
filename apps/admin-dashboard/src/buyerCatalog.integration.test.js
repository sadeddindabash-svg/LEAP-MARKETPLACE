import { describe, it, expect } from 'vitest';
import { login } from './auth';
import { asValidProduct, asValidApproval } from './productFixtures';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// Valid under the catalog's current length rules (names 25-100, descriptions 100-150), so nothing is padded and the exact assertions below hold.
const NAME_EN = 'Front Brake Disc, Vented 300mm (Buyer Catalog Test)';
const NAME_AR = 'قرص فرامل أمامي مهوّى 300 ملم (اختبار كتالوج المشتري)';
const DESC_EN = 'A real English description of this vented front brake disc, written long enough to satisfy the catalog required length.';
const DESC_AR = 'وصف عربي حقيقي لقرص الفرامل الأمامي المهوّى، مكتوب بطول كافٍ لتلبية الحد الأدنى المطلوب في الكتالوج للوصف.';
const PHOTOS = ['/uploads/bc-a.jpg', '/uploads/bc-b.jpg', '/uploads/bc-c.jpg', '/uploads/bc-d.jpg']; // exactly the number the platform requires

async function createApprovedProduct({ nameEn, nameAr } = {}) {
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  const suffix = Date.now() + Math.random();
  const createRes = await fetch(`${BACKEND_URL}/supplier/me/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify(await asValidProduct({
      nameZh: `买家目录测试 ${suffix}`,
      descriptionZh: '中文描述，买家不应看到这个',
      category: 'brake', part: 'Front Brake Disc', position: 'Front', oemNumber: `BUYER-CAT-${suffix}`,
      price: 42.5, currencyCode: 'CNY',
      fitment: { generationId: 'gen_bmw_1_series_f20', year: 2018 },
      images: PHOTOS,
      weightKg: 3.75, lengthCm: 32, widthCm: 32, heightCm: 6,
    })),
  });
  const created = await createRes.json();

  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/catalog/products/${created.id}/moderate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(await asValidApproval({
      action: 'approve',
      nameEn: nameEn || NAME_EN,
      descriptionEn: DESC_EN,
      nameAr: nameAr || NAME_AR,
      descriptionAr: DESC_AR,
    })),
  });
  return created.id;
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('buyer-facing catalog redesign against a REAL running backend', () => {
  it('CRITICAL: the buyer-facing product detail NEVER includes the supplier name, in any form', async () => {
    const productId = await createApprovedProduct();
    const res = await fetch(`${BACKEND_URL}/catalog/products/${productId}`);
    const product = await res.json();
    expect(product.supplierName).toBeUndefined();
    // Belt-and-suspenders: confirm it's absent from the raw JSON text too,
    // not just the specific key we expect — catches an accidental leak
    // under a different key name.
    expect(JSON.stringify(product).toLowerCase()).not.toContain('supplier');
  });

  it('the buyer-facing catalog LIST also never includes the supplier name', async () => {
    await createApprovedProduct();
    const res = await fetch(`${BACKEND_URL}/catalog/products?category=brake`);
    const products = await res.json();
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.supplierName).toBeUndefined();
    }
  });

  it('CRITICAL: the buyer never sees the Chinese name/description, only the approved translation for the requested language', async () => {
    const productId = await createApprovedProduct();
    const enRes = await fetch(`${BACKEND_URL}/catalog/products/${productId}`);
    const enProduct = await enRes.json();
    expect(enProduct.name).toBe(NAME_EN);
    expect(enProduct.nameZh).toBeUndefined();
    expect(enProduct.descriptionZh).toBeUndefined();
    expect(JSON.stringify(enProduct)).not.toMatch(/[\u4e00-\u9fff]/); // no CJK characters anywhere

    const arRes = await fetch(`${BACKEND_URL}/catalog/products/${productId}?lang=ar`);
    const arProduct = await arRes.json();
    expect(arProduct.name).toBe(NAME_AR);
    expect(arProduct.description).toBe(DESC_AR);
  });

  it('falls back to English when Arabic is requested but not present (legacy product)', async () => {
    // p1 is a real seeded product predating the Arabic translation feature.
    const res = await fetch(`${BACKEND_URL}/catalog/products/p1?lang=ar`);
    const product = await res.json();
    expect(product.name).toBe('RIDEX Front Brake Disc, Vented 300mm');
  });

  it('CRITICAL: the product page includes real uploaded photos', async () => {
    const productId = await createApprovedProduct();
    const res = await fetch(`${BACKEND_URL}/catalog/products/${productId}`);
    const product = await res.json();
    expect(product.images).toEqual(PHOTOS);
  });

  it('CRITICAL: the product page includes the real structured fields -- Part, Part No., Brand, Model, Year, Dimensions, Weight', async () => {
    const productId = await createApprovedProduct();
    const res = await fetch(`${BACKEND_URL}/catalog/products/${productId}`);
    const product = await res.json();
    expect(product.part).toBe('Front Brake Disc');
    expect(product.oemNumber).toMatch(/^BUYER-CAT-/);
    expect(product.brand).toBe('BMW');
    expect(product.model).toBe('1 Series');
    expect(product.year).toBe(2018);
    expect(product.weightKg).toBe(3.75);
    expect(product.lengthCm).toBe(32);
    expect(product.widthCm).toBe(32);
    expect(product.heightCm).toBe(6);
  });

  it('CRITICAL: a supplier cannot create a product without shipping dimensions/weight -- mandatory, feeds real shipping-fee calculation', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(await asValidProduct({
        nameZh: '缺少运费信息测试', category: 'brake', part: 'x', position: 'Front', oemNumber: `MISSING-SHIP-${Date.now()}`,
        price: 10, currencyCode: 'CNY', fitment: { generationId: 'gen_bmw_1_series_f20', year: 2017 },
        images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
        // weightKg/lengthCm/widthCm/heightCm deliberately omitted
      })),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('weightKg');
  });

  it('rejects a non-positive weight or dimension', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(await asValidProduct({
        nameZh: '负数运费测试', category: 'brake', part: 'x', position: 'Front', oemNumber: `NEG-SHIP-${Date.now()}`,
        price: 10, currencyCode: 'CNY', fitment: { generationId: 'gen_bmw_1_series_f20', year: 2017 },
        images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
        weightKg: 0, lengthCm: 10, widthCm: 10, heightCm: 10,
      })),
    });
    expect(res.status).toBe(400);
  });
});
