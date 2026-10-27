import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFreeShippingAdmin, saveFreeShipping } from './freeShippingApi';
import { SessionExpiredError } from './auth';

// The real requests the admin portal sends for the free-shipping settings, with the network replaced by one fixed answer.
let calls;
const answer = (status, body) => { globalThis.fetch = vi.fn(async (url, options) => { calls.push({ url: String(url).replace(/^https?:\/\/[^/]+/, ''), options }); return { ok: status < 400, status, json: async () => body }; }); };
beforeEach(() => { calls = []; });

describe('the free shipping requests', () => {
  it('reading is a GET of the admin view with the token', async () => {
    answer(200, { enabled: true, thresholdUsd: 50, feeUsd: 5, limits: {} }); const r = await fetchFreeShippingAdmin('tok');
    expect(calls[0].url).toBe('/platform-settings/free-shipping/admin'); expect(calls[0].options.headers.Authorization).toBe('Bearer tok'); expect(calls[0].options.method).toBeUndefined(); expect(r.thresholdUsd).toBe(50);
  });
  it('saving is a PUT with exactly the three values (as numbers), the token and a JSON body', async () => {
    answer(200, { enabled: true, thresholdUsd: 75.5, feeUsd: 4.25 }); await saveFreeShipping('tok', { enabled: true, thresholdUsd: 75.5, feeUsd: 4.25, extra: 'ignored' });
    expect(calls[0].url).toBe('/platform-settings/free-shipping'); expect(calls[0].options.method).toBe('PUT'); expect(calls[0].options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' });
    expect(JSON.parse(calls[0].options.body)).toEqual({ enabled: true, thresholdUsd: 75.5, feeUsd: 4.25 });
  });
  it('an expired sign-in and a refusal are told apart, and the refusal keeps the server\'s words', async () => {
    answer(401, {}); await expect(fetchFreeShippingAdmin('t')).rejects.toBeInstanceOf(SessionExpiredError); await expect(saveFreeShipping('t', { enabled: false, thresholdUsd: 0, feeUsd: 0 })).rejects.toBeInstanceOf(SessionExpiredError);
    answer(400, { error: 'Enter a shipping fee above 0' }); await expect(saveFreeShipping('t', { enabled: true, thresholdUsd: 50, feeUsd: 0 })).rejects.toThrow('Enter a shipping fee above 0');
    answer(500, {}); await expect(fetchFreeShippingAdmin('t')).rejects.toThrow('Request failed (500)');
  });
});
