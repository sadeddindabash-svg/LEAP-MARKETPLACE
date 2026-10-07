/**
 * Test helpers that make a product valid under the server's CURRENT rules, whatever shorthand an older test builds it with.
 *
 * WHY: the rules for a new product have grown over time (a minimum name length, exactly as many photos as the platform setting says, a
 * video, and for approval a reviewed English AND Arabic name and description of a set length), and a dozen older integration tests
 * were still building products the old way, so they failed on validation before testing what they were written to test.
 *
 * `asValidProduct(body)` and `asValidApproval(body)` only ADD or PAD what is missing; whatever the test deliberately set is kept (and kept
 * FIRST in a name, so a test that searches for its own unique name still finds it). Use them around a body that is meant to be valid, or
 * around a body that deliberately breaks ONE rule other than these (a bad category, a wrong currency...).
 */
const BACKEND_URL = 'http://localhost:4000';

// The seed part most tests build their products with. If a past run (or a person) deleted it, creating a product with it fails validation and
// a dozen unrelated tests fail with it, so the fixtures put it back first. Creating it is harmless if it already exists (the server says 409).
const SEED_PARTS = [{ category: 'brake', nameEn: 'Front Brake Disc', nameAr: 'قرص فرامل أمامي' }];
let seedPartsChecked = false;
export async function ensureSeedParts() {
  if (seedPartsChecked) return;
  const login = await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@leap.dev', password: 'admin_dev_password_123' }) }).then((r) => r.json());
  for (const part of SEED_PARTS) {
    await fetch(`${BACKEND_URL}/catalog/categories/${part.category}/parts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
      body: JSON.stringify({ nameEn: part.nameEn, nameAr: part.nameAr }),
    });
  }
  seedPartsChecked = true;
}

let cachedRequirements = null;
async function currentRequirements() {
  if (!cachedRequirements) cachedRequirements = await fetch(`${BACKEND_URL}/catalog/product-requirements`).then((r) => r.json());
  return cachedRequirements;
}

const padTo = (text, min, filler) => {
  let out = String(text);
  while (out.length < min) out += filler;
  return out;
};
const trimTo = (text, max) => String(text).slice(0, max);

// A supplier's new-product body, made valid: name 10-100 characters, exactly `minPhotos` photos, a video when one is required.
export async function asValidProduct(body) {
  if (SEED_PARTS.some((p) => p.category === body.category && p.nameEn === body.part)) await ensureSeedParts();
  const requirements = await currentRequirements();
  const images = Array.isArray(body.images) ? [...body.images] : [];
  while (requirements.photosRequired && images.length < requirements.minPhotos) images.push(`/uploads/fixture-${images.length + 1}-${Date.now()}.jpg`);
  const valid = { ...body, images };
  if (typeof body.nameZh === 'string') valid.nameZh = trimTo(padTo(body.nameZh, 10, '测试产品名称填充'), 100);
  if (requirements.videoRequired && !body.videoUrl) valid.videoUrl = '/uploads/fixture-video.mp4';
  return valid;
}

// An admin's approval body, made valid: English and Arabic names of 25-100 characters and descriptions of 100-150 (no Chinese characters).
export async function asValidApproval(body) {
  if (body.action !== 'approve') return body;
  const unique = String(body.nameEn || body.nameAr || Date.now()).replace(/[\u4e00-\u9fff]/g, '').trim() || String(Date.now());
  const nameEn = trimTo(padTo(body.nameEn || unique, 25, ' compatible replacement part'), 100);
  const nameAr = trimTo(padTo(body.nameAr || 'قطعة غيار متوافقة للاختبار', 25, ' قطعة غيار متوافقة'), 100);
  const descriptionEn = trimTo(padTo(body.descriptionEn || 'A reviewed description written for an automated test of the catalog.', 100, ' It is a compatible replacement part.'), 150);
  const descriptionAr = trimTo(padTo(body.descriptionAr || 'وصف تمت مراجعته ومكتوب لاختبار آلي للكتالوج.', 100, ' إنها قطعة غيار متوافقة وجاهزة.'), 150);
  return { ...body, nameEn, nameAr, descriptionEn, descriptionAr };
}
