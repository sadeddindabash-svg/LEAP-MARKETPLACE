import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUnusedPictures, removeUnusedPictures, previewVehicleImport, commitVehicleImport, SessionExpiredError } from './auth';

// The real requests the admin portal sends for the unused pictures and for "use the pictures in this file", with the network replaced by one fixed answer.
let calls;
const answer = (status, body) => { globalThis.fetch = vi.fn(async (url, options) => { calls.push({ url: String(url).replace(/^https?:\/\/[^/]+/, ''), options }); return { ok: status < 400, status, json: async () => body }; }); };
beforeEach(() => { calls = []; });

describe('unused pictures', () => {
  it('looking is a GET with the admin\'s token and removes nothing', async () => {
    answer(200, { count: 2, bytes: 10, scanned: 5, tooNew: 0 }); expect(await fetchUnusedPictures('tok')).toEqual({ count: 2, bytes: 10, scanned: 5, tooNew: 0 });
    expect(calls[0].url).toBe('/fitment/import/unused-pictures'); expect(calls[0].options.method).toBe('GET'); expect(calls[0].options.headers.Authorization).toBe('Bearer tok'); expect(calls[0].options.body).toBeUndefined();
  });
  it('removing is a POST that carries the explicit confirm', async () => {
    answer(200, { removed: 2, bytes: 10, failed: 0 }); await removeUnusedPictures('tok'); expect(calls[0].url).toBe('/fitment/import/unused-pictures/remove'); expect(calls[0].options.method).toBe('POST'); expect(JSON.parse(calls[0].options.body)).toEqual({ confirm: true }); expect(calls[0].options.headers['Content-Type']).toBe('application/json');
  });
  it('an expired sign-in and a refusal are told apart', async () => {
    answer(401, {}); await expect(fetchUnusedPictures('tok')).rejects.toBeInstanceOf(SessionExpiredError); await expect(removeUnusedPictures('tok')).rejects.toBeInstanceOf(SessionExpiredError);
    answer(500, { error: 'Something broke' }); await expect(fetchUnusedPictures('tok')).rejects.toThrow('Something broke');
  });
});
describe('the import sends the choice about pictures with the file', () => {
  const file = new File([new Uint8Array(10)], 'v.xlsx');
  it.each([[true, '1'], [false, '0']])('preview and import with the choice %s send replacePictures=%s (and the mode)', async (choice, sent) => {
    answer(200, { summary: {} }); await previewVehicleImport('tok', file, 'skip', choice); await commitVehicleImport('tok', file, 'update', choice);
    expect(calls.map((c) => [c.url, c.options.body.get('replacePictures'), c.options.body.get('mode')])).toEqual([['/fitment/import/preview', sent, 'skip'], ['/fitment/import/commit', sent, 'update']]);
  });
  it('without a choice it is off (the old behaviour for anything that does not know about it)', async () => { answer(200, { summary: {} }); await previewVehicleImport('tok', file); expect(calls[0].options.body.get('replacePictures')).toBe('0'); });
});
