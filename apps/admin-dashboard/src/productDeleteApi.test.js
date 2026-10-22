import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkProductDelete, deleteProducts, sendProductsToReview, fetchAdminProducts, SessionExpiredError } from './auth';

// The real requests the admin portal sends to check and to delete products, with the network replaced by one fixed answer.
let calls;
const answer = (status, body) => { globalThis.fetch = vi.fn(async (url, options) => { calls.push({ url: String(url).replace(/^https?:\/\/[^/]+/, ''), options }); return { ok: status < 400, status, json: async () => body }; }); };
beforeEach(() => { calls = []; });

describe('checking and deleting products', () => {
  it('the check is a POST of the ids with the admin\'s token (it deletes nothing)', async () => {
    answer(200, { deletable: [], held: [] }); await checkProductDelete('tok', ['a', 'b']); expect(calls[0].url).toBe('/catalog/admin/products/delete-check'); expect(calls[0].options.method).toBe('POST'); expect(calls[0].options.headers.Authorization).toBe('Bearer tok'); expect(JSON.parse(calls[0].options.body)).toEqual({ ids: ['a', 'b'] });
  });
  it('the deletion sends the ids and the confirmation (true for one product, the sentence for several)', async () => {
    answer(200, { deleted: [] }); await deleteProducts('tok', ['a'], true); await deleteProducts('tok', ['a', 'b'], 'DELETE PRODUCTS');
    expect(calls.map((c) => [c.url, JSON.parse(c.options.body)])).toEqual([['/catalog/admin/products/delete', { ids: ['a'], confirm: true }], ['/catalog/admin/products/delete', { ids: ['a', 'b'], confirm: 'DELETE PRODUCTS' }]]);
  });
  it('an expired sign-in and a refusal are told apart, and the refusal keeps the server\'s words', async () => {
    answer(401, {}); await expect(checkProductDelete('tok', ['a'])).rejects.toBeInstanceOf(SessionExpiredError); await expect(deleteProducts('tok', ['a'], true)).rejects.toBeInstanceOf(SessionExpiredError);
    answer(400, { error: 'To delete several products at once, type DELETE PRODUCTS to confirm. Nothing was deleted.' }); await expect(deleteProducts('tok', ['a', 'b'], 'x')).rejects.toThrow('Nothing was deleted.');
  });
});

describe('hidden products', () => {
  it('the list asks for the hidden ones only when told to (status=hidden), and for the live ones otherwise', async () => {
    answer(200, { products: [], total: 0 }); await fetchAdminProducts('tok', { search: 'x', page: 1 }); await fetchAdminProducts('tok', { page: 1, status: 'hidden' });
    expect(new URL('http://x' + calls[0].url).searchParams.get('status')).toBeNull(); expect(new URL('http://x' + calls[1].url).searchParams.get('status')).toBe('hidden'); expect(calls[1].url.startsWith('/catalog/admin/products?')).toBe(true);
  });
  it('sending back to review is a POST of the ids with the token; an expired sign-in and a refusal are told apart', async () => {
    answer(200, { sent: [], skipped: [] }); await sendProductsToReview('tok', ['a', 'b']); expect(calls[0].url).toBe('/catalog/admin/products/send-to-review'); expect(calls[0].options.method).toBe('POST'); expect(JSON.parse(calls[0].options.body)).toEqual({ ids: ['a', 'b'] }); expect(calls[0].options.headers.Authorization).toBe('Bearer tok');
    answer(401, {}); await expect(sendProductsToReview('tok', ['a'])).rejects.toBeInstanceOf(SessionExpiredError); answer(400, { error: 'No product was chosen' }); await expect(sendProductsToReview('tok', [])).rejects.toThrow('No product was chosen');
  });
});
