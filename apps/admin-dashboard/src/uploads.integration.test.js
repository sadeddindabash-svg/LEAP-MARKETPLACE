import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import { login } from './auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name));
}

// Real multipart/form-data encoding via the well-established `form-data`
// package rather than Node's native fetch FormData/Blob -- the native
// implementation was found to hang against this project's real
// multer-based upload endpoint (a real, if annoying, tooling
// incompatibility, not an application bug -- the same real upload was
// separately confirmed working correctly via a direct curl -F call).
function uploadImage(token, filename, buffer, contentType = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('image', buffer, { filename, contentType });
    const headers = form.getHeaders();
    if (token) headers.Authorization = `Bearer ${token}`;
    form.submit({ host: 'localhost', port: 4000, path: '/uploads/product-image', headers }, (err, res) => {
      if (err) return reject(err);
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (parseErr) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
  });
}

describe.runIf(backendUp)('real product image upload (local disk fallback / cloud storage) against a REAL running backend', () => {
  it('CRITICAL: a real, valid high-resolution image uploads successfully and reports which real storage backend was used', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const buffer = loadFixture('valid-test-image.jpg');
    const { status, body } = await uploadImage(token, 'valid.jpg', buffer);

    expect(status).toBe(201);
    expect(body.width).toBe(900);
    expect(body.height).toBe(900);
    expect(body.url).toBeTruthy();
    // No real cloud credentials are configured in this test environment
    // (see services/api/src/modules/storage/client.js's honest fallback) --
    // this should genuinely report 'local', not a fabricated 'cloud'.
    expect(body.storage).toBe('local');
    expect(body.url).toMatch(/^\/uploads\//);
  });

  it('CRITICAL: a real image below the minimum resolution is rejected with a clear, real reason', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const buffer = loadFixture('too-small-test-image.jpg');
    const { status, body } = await uploadImage(token, 'small.jpg', buffer);

    expect(status).toBe(400);
    expect(body.error).toContain('resolution too low');
    expect(body.error).toContain('400x400');
  });

  it('a real non-image file is rejected, not silently accepted', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const { status } = await uploadImage(token, 'fake.jpg', Buffer.from('this is not a real image'), 'text/plain');
    expect(status).toBe(400);
  });

  it('unauthenticated uploads are rejected', async () => {
    const buffer = loadFixture('valid-test-image.jpg');
    const { status } = await uploadImage(null, 'valid.jpg', buffer);
    expect(status).toBe(401);
  });

  it('CRITICAL: a real buyer can now also upload real images (migration 031, for review photos) -- previously rejected here, deliberately changed', async () => {
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `upload-test-${Date.now()}@example.com`, password: 'test_password_123' }),
    });
    const { token } = await signupRes.json();
    const buffer = loadFixture('valid-test-image.jpg');
    const { status, body } = await uploadImage(token, 'valid.jpg', buffer);
    expect(status).toBe(201);
    expect(body.storage).toBe('local');
  });

  it('a real hub staff account (not just suppliers) can also upload real images, for shipment-inspection evidence', async () => {
    const { token } = await login('hub@leap.dev', 'hub_dev_password_123');
    const buffer = loadFixture('valid-test-image.jpg');
    const { status, body } = await uploadImage(token, 'evidence.jpg', buffer);
    expect(status).toBe(201);
    expect(body.storage).toBe('local');
  });
});
