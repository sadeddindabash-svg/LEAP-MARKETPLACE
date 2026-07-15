// @vitest-environment node
//
// This file needs the real Node fetch/FormData/Blob implementations to
// perform genuine multipart image uploads against the real backend —
// jsdom's polyfills for these (the project's default test environment,
// needed elsewhere for rendering React components) don't correctly
// serialize multipart bodies, which silently hangs the request rather
// than erroring clearly. Found via this exact test timing out with no
// useful error message until isolated with a plain Node script.
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

async function makeTestJpeg(widthPx, heightPx) {
  // A minimal real JPEG isn't trivial to hand-construct, so instead we
  // build a valid PNG (much simpler byte format) and send it with the
  // correct image/png mimetype — the backend validates by real decoded
  // pixel dimensions via the `image-size` library, not by file extension,
  // so this exercises the real validation path faithfully.
  // Build a solid-color, uncompressed-color-type PNG large enough to
  // exceed/undercut the 800px minimum as needed.
  const zlib = await import('zlib');
  const width = widthPx, height = heightPx;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      raw.writeUInt8(200, rowStart + 1 + x * 3);
      raw.writeUInt8(50, rowStart + 1 + x * 3 + 1);
      raw.writeUInt8(50, rowStart + 1 + x * 3 + 2);
    }
  }
  const idat = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  function crc32(buf) {
    let c;
    const table = crc32.table || (crc32.table = (() => {
      const t = [];
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c;
      }
      return t;
    })());
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

async function uploadRealImage(token, widthPx, heightPx) {
  const buf = await makeTestJpeg(widthPx, heightPx);
  const formData = new FormData();
  formData.append('image', new Blob([buf], { type: 'image/png' }), 'test.png');
  const res = await fetch(`${BACKEND_URL}/uploads/product-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return { res, body: await res.json() };
}

const backendUp = await isBackendUp();

describe.runIf(backendUp)('structured supplier product submission against a REAL running backend', () => {
  it('the fitment cascade resolves Brand -> Model -> Generation -> Engine/Transmission with real seeded data', async () => {
    const brandsRes = await fetch(`${BACKEND_URL}/fitment/brands`);
    const brands = await brandsRes.json();
    const bmw = brands.find((b) => b.name === 'BMW');
    expect(bmw).toBeDefined();

    const modelsRes = await fetch(`${BACKEND_URL}/fitment/brands/${bmw.id}/models`);
    const models = await modelsRes.json();
    expect(models.length).toBeGreaterThan(0);

    const genRes = await fetch(`${BACKEND_URL}/fitment/models/${models[0].id}/generations`);
    const generations = await genRes.json();
    expect(generations.length).toBeGreaterThan(0);

    const [engRes, transRes] = await Promise.all([
      fetch(`${BACKEND_URL}/fitment/generations/${generations[0].id}/engines`),
      fetch(`${BACKEND_URL}/fitment/generations/${generations[0].id}/transmissions`),
    ]);
    expect((await engRes.json()).length).toBeGreaterThan(0);
    expect((await transRes.json()).length).toBeGreaterThan(0);
  });

  it('rejects a real image upload below the minimum resolution', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const { res, body } = await uploadRealImage(token, 300, 300);
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/resolution too low/i);
  });

  it('accepts a real image upload at/above the minimum resolution and returns a usable URL', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const { res, body } = await uploadRealImage(token, 900, 850);
    expect(res.status).toBe(201);
    expect(body.url).toMatch(/^\/uploads\//);

    // Confirm it's genuinely served back.
    const fileRes = await fetch(`${BACKEND_URL}${body.url}`);
    expect(fileRes.status).toBe(200);
  });

  it('rejects product creation with fewer than 3 photos', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nameZh: '测试', category: 'brake', part: 'x', position: 'Front', oemNumber: '123',
        price: 10, currencyCode: 'USD', fitment: { generationId: 'gen_bmw_1_series_f20', year: 2017 },
        images: ['/uploads/a.jpg', '/uploads/b.jpg'],
        weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a fitment year outside the real generation\'s actual range', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nameZh: '测试', category: 'brake', part: 'x', position: 'Front', oemNumber: '123',
        price: 10, currencyCode: 'USD', fitment: { generationId: 'gen_bmw_1_series_f20', year: 1999 },
        images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
        weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('CRITICAL: creates a real product with real photos and real fitment, then an admin cannot approve it without providing a translation', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const upload1 = await uploadRealImage(token, 900, 850);
    const upload2 = await uploadRealImage(token, 900, 850);
    const upload3 = await uploadRealImage(token, 900, 850);

    const createRes = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nameZh: `真实端到端测试 ${Date.now()}`,
        category: 'brake', part: 'Front Brake Disc', position: 'Front', oemNumber: `OEM-E2E-${Date.now()}`,
        price: 39.99, currencyCode: 'USD', stockQuantity: 20,
        fitment: { generationId: 'gen_bmw_1_series_f20', year: 2016 },
        images: [upload1.body.url, upload2.body.url, upload3.body.url],
        weightKg: 3.5, lengthCm: 28, widthCm: 28, heightCm: 4,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.images.length).toBe(3);
    expect(created.fitment[0].brand).toBe('BMW');

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const queueRes = await fetch(`${BACKEND_URL}/catalog/moderation-queue`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const queue = await queueRes.json();
    const inQueue = queue.find((p) => p.id === created.id);
    expect(inQueue).toBeDefined();
    expect(inQueue.nameZh).toBe(created.nameZh);
    expect(inQueue.images.length).toBe(3);

    const rejectApproveRes = await fetch(`${BACKEND_URL}/catalog/products/${created.id}/moderate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(rejectApproveRes.status).toBe(400);

    // English alone is no longer enough either — the confirmed
    // 40-country launch list includes the entire GCC plus Jordan.
    const englishOnlyRes = await fetch(`${BACKEND_URL}/catalog/products/${created.id}/moderate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'approve', nameEn: 'Front Brake Disc, Vented (E2E Test)' }),
    });
    expect(englishOnlyRes.status).toBe(400);

    const approveRes = await fetch(`${BACKEND_URL}/catalog/products/${created.id}/moderate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'approve', nameEn: 'Front Brake Disc, Vented (E2E Test)', nameAr: 'قرص فرامل أمامي مهوى (اختبار)' }),
    });
    expect(approveRes.status).toBe(200);
    const approved = await approveRes.json();
    expect(approved.name).toBe('Front Brake Disc, Vented (E2E Test)');
    expect(approved.name_ar).toBe('قرص فرامل أمامي مهوى (اختبار)');

    // Confirm buyers now see the English name, not the Chinese original.
    const buyerViewRes = await fetch(`${BACKEND_URL}/catalog/products/${created.id}`);
    const buyerView = await buyerViewRes.json();
    expect(buyerView.name).toBe('Front Brake Disc, Vented (E2E Test)');
  });
});
